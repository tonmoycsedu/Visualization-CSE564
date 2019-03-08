import warnings
from itertools import combinations

import numpy as np
import pandas as pd
from scipy.stats import pearsonr, chisquare

from enum import Enum
from pycausal import PDAG, Vertex, Edge, MoralGraph, Skeleton, fisher_z_ci, \
                     corr_matrix, gauss_ci_test, disc_ci_test
from pycausal.__util__ import *


def build_moral_graph(corr_matr, n, alpha=0.05, verbose=False):
    verboseprint = print if verbose else lambda *a, **k: None

    nd = corr_matr.shape[0]

    moral = MoralGraph(nd)
    all = list(range(nd))
    for i in range(nd - 1):
        for j in range(i + 1, nd):
            K = [x for x in all if x != i and x != j]
            if fisher_z_ci(i, j, K, corr_matr, n) <= alpha:
                verboseprint("moral link", i, "--", j)
                moral.add_edge(i, j)
    return moral


def infer_pdag_from_moral(moral_graph, corr_matr, n, alpha=0.05,
                          verbose=False):
    if not isinstance(moral_graph, MoralGraph):
        raise RuntimeError("'moral_graph' must be an instance of the \
                            MoralGraph class.")
    if len(moral_graph.vertices) != corr_matr.shape[0]:
        raise RuntimeError("Dimension of 'corr_matr' doesn't match the \
                            number of vertices in 'moral_graph.")

    verboseprint = print if verbose else lambda *a, **k: None

    moral_graph.clear_sp()
    verboseprint("Spouse marks in 'moral_graph' have been reset.")

    C = set()      # set of recognized V-structures
    sp = set()     # set of recognized spouse links

    nd = len(moral_graph.vertices)  # number of vertices
    for x in range(nd - 1):
        for y in range(x + 1, nd):
            # for each pair of vertices x and y
            tri_xy = moral_graph.triangle(x, y)
            if tri_xy is None or len(tri_xy) == 0:
                continue

            S_xy = None     # d-separating set of x and y

            # B <- smallest set of {Bd(X)\Tri(X-Y)\{Y}, Bd(Y)\Tri(X−Y)\{X}}
            bd_x = list_diff(moral_graph.boundary(x), tri_xy + [y])
            bd_y = list_diff(moral_graph.boundary(y), tri_xy + [x])
            B = bd_y if len(bd_x) > len(bd_y) else bd_x

            subsets_tri = list_powerset(tri_xy)
            for S in subsets_tri:
                # check each subset S of the triangle set
                Z = list_union(B, S)
                verboseprint("conditioning on (", str(Z), ")")
                if fisher_z_ci(x, y, Z, corr_matr, n) > alpha:
                    # found a d-separating set
                    verboseprint("CI, spouse link", x, "--", y)
                    S_xy = Z
                else:
                    # otherwise check if B includes any child of colliders
                    # W <- Tri(X−Y)\S, S is considered in d-separating set,
                    # W are potential colliders in the current loop
                    W = list_diff(tri_xy, S)
                    if len(W) == 0:
                        continue
                    # D <- B ∩ {nodes reachable in moral graph by those in W}
                    # thus D is the set of colliders' children
                    D = []
                    for w in W:
                        D.extend(moral_graph.boundary(w))
                    D = list_intersect(B, D)
                    if len(D) == 0:
                        continue

                    B_st = list_diff(B, D)  # not childern of colliders
                    subsets_D = list_powerset(D, has_self=False)
                    for S_st in subsets_D:
                        Z = list_union(B_st, S_st, S)
                        verboseprint("conditioning on (", str(Z), ")")
                        if fisher_z_ci(x, y, Z, corr_matr, n) > alpha:
                            # found a d-separating set
                            verboseprint("CI, spouse link", x, "--", y)
                            S_xy = Z
                            break
                # stop searching if d-separating set exists
                if S_xy is not None:
                    verboseprint("d-separating set:", S_xy)
                    break

            if S_xy is not None:
                # store spouse links
                sp.add(tuple([x, y]))
                # colliders are those in Tri_xy but not in S.xy
                colliders = list_diff(tri_xy, S_xy)
                for c in colliders:
                    C.add(tuple([x, y, c]))

    verboseprint("V-structures:", C)

    moral_graph.mark_sp(sp)
    non_sp = moral_graph.non_sp_links()     # set of frozensets

    dir = []
    for c in C:
        xz = [c[0], c[2]]
        yz = [c[1], c[2]]
        if link_in_lst(xz, non_sp) and link_in_lst(yz, non_sp):
            if not link_in_lst(xz, dir):
                dir.append(xz)
            if not link_in_lst(yz, dir):
                dir.append(yz)

    undir = link_lst_diff(non_sp, dir)
    verboseprint("dir:", dir)
    verboseprint("undir:", undir)

    return {"directed": dir, "undirected": undir}


def propagate(edges, nd, verbose=False):
    if len(edges["directed"]) == 0:
        return edges

    verboseprint = print if verbose else lambda *a, **k: None

    dir = edges["directed"]
    undir = edges["undirected"]

    changed = True
    while changed:
        changed = False
        # preserve acyclicity
        for l in undir:
            if has_direct_path(l[0], l[1], dir):
                dir.append([l[0], l[1]])
                undir.remove(l)
                changed = True
                verboseprint("Direct path: " + str(l[0]) + '->-' + str(l[1]))
            elif has_direct_path(l[1], l[0], dir):
                dir.append([l[1], l[0]])
                undir.remove(l)
                changed = True
                verboseprint("Direct path: " + str(l[1]) + '->-' + str(l[0]))
        # no new V-structure
        for l in undir:
            l0 = len([e[0] for e in dir if e[1] == l[0]])
            l1 = len([e[0] for e in dir if e[1] == l[1]])
            if l0 > 0 and l1 == 0:
                dir.append([l[0], l[1]])
                undir.remove(l)
                changed = True
                verboseprint("X->Y-Z: " + str(l[0]) + '->-' + str(l[1]))
            elif l0 == 0 and l1 > 0:
                dir.append([l[1], l[0]])
                undir.remove(l)
                changed = True
                verboseprint("X->Y-Z: " + str(l[1]) + '->-' + str(l[0]))

    return {"directed": dir, "undirected": undir}


def learn_causal_pdag_tc(df, alpha=0.05, title="", verbose=False):
    if alpha > 0.1:
        warnings.warn("'alpha' greater than 0.1 may lose the meaning of \
                       statistical significance.")
    if df.shape[0] <= df.shape[1]:
        warnings.warn("too few data points, \
                      no relations can be learned.")
        return PDAG.from_edge_list({"directed": [], "undirected": []},
                                   df.shape[1], df.columns.values, title)
    ext = df.max() - df.min()
    indeps = []
    for i, v in enumerate(df.columns.values):
        if ext[i] == 0:
            indeps.append(v)
    if len(indeps) > 0:
        df = df.drop(indeps, axis=1)

    corr_matr = corr_matrix(df).values
    n = df.shape[0]
    labels = df.columns.values
    nd = corr_matr.shape[0]

    moral = build_moral_graph(corr_matr, n, alpha, verbose)

    edge_list = infer_pdag_from_moral(moral, corr_matr, n, alpha,
                                      verbose)
    edge_list = propagate(edge_list, nd, verbose)

    pdag = PDAG.from_edge_list(edge_list, nd, labels, title)

    return pdag.append_vertices(indeps)


def learn_skeleton(suffStat, ci_func, p, alpha=0.05, verbose=False):
    """Learn skeleton of the causal graph with the PC-stable algorithm

    Args:
        suffStat: sufficient statistics
        ci_func: function for condition indipendent test
        p: number of variables
        alpha: pvalue level for conditional independent tests
    """
    verboseprint = print if verbose else lambda *a, **k: None
    seq_p = list(range(p))
    G = np.full((p, p), True, dtype=bool)
    np.fill_diagonal(G, False)

    sepset = [[None for j in range(p)] for i in range(p)]
    # pMax = np.full((p, p), float('-inf'))
    done = False
    ord = 0
    # n_edgetests = []
    while not done and G.any():
        # n_edgetests.append(0)
        done = True

        ind = np.where(G)
        remEdges = list(zip(ind[0], ind[1]))    # remaining edges with order V
        verboseprint("Order=" + str(ord) + "; remaining edges:", len(remEdges))
        G_l = np.copy(G)
        for e in remEdges:
            # if verbose and (verbose >= 2 or i % 100 == 0):
            #     print("|i=" + str(i), "|iMax=", len(remEdges))
            x = e[0]
            y = e[1]
            if G[y, x]:
                nbrsBool = np.copy(G_l[x, :])
                nbrsBool[y] = False
                nbrs = [k for k in seq_p if nbrsBool[k]]
                length_nbrs = len(nbrs)
                if length_nbrs >= ord:
                    if length_nbrs > ord:
                        done = False
                    sets = combinations(range(length_nbrs), ord)
                    for ts in sets:
                        # n_edgetests[ord] += 1
                        S = [nbrs[k] for k in ts]
                        # independent test
                        pval = ci_func(suffStat, x, y, S)
                        if np.isnan(pval):
                            pval = 1
                        verboseprint("x=" + str(x), " y=" + str(y),
                                     " S=", S, ": pval = " + str(pval))
                        # if pMax[x, y] < pval:
                        #     pMax[x, y] = pval
                        if pval >= alpha:
                            G[x, y] = G[y, x] = False
                            sepset[x][y] = S
                            if sepset[y][x] is None:
                                sepset[y][x] = S
                            verboseprint("false link removed.")
                            break
        ord += 1
    # for i in range(p - 1):
    #     for j in range(2, p):
    #         pMax[i, j] = pMax[j, i] = max(pMax[i, j], pMax[j, i])
    edges = []
    for i in range(p - 1):
        for j in range(i, p):
            if G[i, j]:
                edges.append((i, j))
    return Skeleton(p, edges, sepset, ord - 1)


def resolve_skeleton(skl, verbose=False):
    if not isinstance(skl, Skeleton):
        raise RuntimeError("'skl' must be an instance of class Skeleton.")
    if len(skl) == 0:
        return {"directed": [], "undirected": []}
    G = skl.adj_matr()      # adjacent matrix, 2 means undirected
    ind = np.where(G)
    remEdges = list(zip(ind[0], ind[1]))    # remaining edges in skeleton
    seq = list(range(skl.n))
    for e in remEdges:
        x = e[0]
        y = e[1]
        nbrs_y = [k for k in seq if k != x and G[y, k] == 1]
        for z in nbrs_y:
            if G[x, z] == 0 and G[z, x] == 0 and \
                    y not in skl.sepsets[x][z] and \
                    y not in skl.sepsets[z][x]:
                if G[x, y] == 1:
                    G[y, x] = 0
                else:
                    G[x, y] = G[y, x] = 2
                if G[z, y] == 1:
                    G[y, z] = 0
                else:
                    G[z, y] = G[y, z] = 2
                if verbose:
                    print("found V-structure:", x, "->", y, "<-", z)
    dir = []
    und = []
    for i in range(skl.n):
        for j in range(skl.n):
            if G[i, j] == 1:
                dir.append([i, j])
            elif G[i, j] == 2 and i < j:
                und.append([i, j])
    return {"directed": dir, "undirected": und}


def learn_causal_pdag_pc(df, dtype='num', alpha=0.05, title="", verbose=False):
    indeps = []
    for v in df.columns.values:
        if df[v].min() == df[v].max():
            indeps.append(v)
    df = df.drop(indeps, axis=1)

    n, p = df.shape
    if dtype == 'num':
        suffStat = {'corr': corr_matrix(df).values, 'n': n}
        skl = learn_skeleton(suffStat, gauss_ci_test, p, alpha, verbose)
        edges = resolve_skeleton(skl)
        pdag = PDAG.from_edge_list(edges, p, df.columns.values)
    elif dtype == 'cat':
        suffStat = {'dm': df.values}
        skl = learn_skeleton(suffStat, disc_ci_test, p, alpha, verbose)
        edges = resolve_skeleton(skl)
        pdag = PDAG.from_edge_list(edges, p, df.columns.values)
    else:
        raise RuntimeError("'dtype' can only be either 'num' or 'cat'.")

    return pdag.append_vertices(indeps)


def learn_correlation_graph(df, categorical_columns=[], alpha=0.05):
    edges = []
    rs = []
    n = df.shape[1]
    nms = df.columns.values
    for i in range(n):
        for j in range(i + 1, n):
            if nms[i] in categorical_columns and nms[j] in categorical_columns:
                csq, p = chisquare(df.iloc[:, i], df.iloc[:, j])
                if p < alpha:
                    edges.append([i, j])
                    rs.append(csq)
            else:
                csq, p = pearsonr(df.iloc[:, i], df.iloc[:, j])
                if p < alpha:
                    edges.append([i, j])
                    rs.append(csq)
    pdag = PDAG()
    for i in range(n):
        pdag.add_vertex(Vertex(i, nms[i]))
    for ed, r in zip(edges, rs):
        v1 = pdag.vertices[ed[0]]
        v2 = pdag.vertices[ed[1]]
        new_edge = Edge(v1, v2)
        new_edge.beta = r
        pdag.edges.append(new_edge)
    pdag.type = "correlation"
    return pdag
