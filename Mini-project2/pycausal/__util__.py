from itertools import combinations


def list_powerset(lst, has_self=True):
    result = [[]]
    l = len(lst) + 1 if has_self else len(lst)
    for n in range(1, l):
        result.extend(list(map(list, list(combinations(lst, n)))))
    return result


def list_diff(lst1, lst2):
    return [x for x in lst1 if x not in lst2]


def list_intersect(lst1, lst2):
    return list(set(lst1) & set(lst2))


def list_union(*args):
    return list(set().union(*args))


def has_direct_path(x, y, edge_list):
    fringe = [x]
    visited = []
    while len(fringe) > 0:
        v = fringe.pop()
        if v == y:
            return True
        if v in visited:
            continue
        childern = [ed[1] for ed in edge_list if ed[0] == v]
        fringe.extend(childern)
        visited.append(v)
    return False


def link_in_lst(link, link_lst):
    for l in link_lst:
        if (l[0] == link[0] and l[1] == link[1]) or \
                (l[0] == link[1] and l[1] == link[0]):
            return True
    return False


def edge_in_lst(edge, edge_lst):
    for e in edge_lst:
        if e[0] == edge[0] and e[1] == edge[1]:
            return True
    return False


def link_lst_diff(lst1, lst2):
    set_lst1 = [set(x) for x in lst1]
    set_lst2 = [set(x) for x in lst2]
    diff = [x for x in set_lst1 if x not in set_lst2]
    return [sorted(list(x)) for x in diff]
