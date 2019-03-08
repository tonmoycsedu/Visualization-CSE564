import numpy as np
import pandas as pd
from scipy.stats import chi2_contingency
import operator as op


def __cramers_v(cv1, cv2):
    confusions = pd.crosstab(cv1, cv2).values
    chi2 = chi2_contingency(confusions)[0]
    n = confusions.sum()
    return np.sqrt(chi2 / (n * (min(confusions.shape) - 1)))


def __norm_map(map):
    ma = max(map.values())
    mi = min(map.values())
    for c in map.keys():
        map[c] = (map[c] - mi) / (ma - mi)
    return map


def __map(nv, cv):
    map = dict()
    for n, c in zip(nv, cv):
        map[str(c)] = map.get(str(c), []) + [n]
    for c in map.keys():
        map[c] = np.mean(map[c])
    return __norm_map(map)


def __order(sorted_levels, map):
    order = {}
    for i, l in enumerate(sorted_levels):
        order[str(l)] = i
    return [order[str(l[0])] for l in sorted(map.items(),
                                             key=op.itemgetter(1))]


def __map_global(df,
                 categorical_column,
                 numeric_columns):
    maps = {}
    corrs = {}
    cc = categorical_column
    lvls = sorted(set(df[cc]))
    for nc in numeric_columns:
        maps[nc] = __map(df[nc].tolist(), df[cc].tolist())
        vec = pd.Series([maps[nc][str(x)] for x in df[cc]], dtype=np.float64)
        corrs[nc] = vec.corr(df[nc])
    max_nc = max(corrs.items(), key=op.itemgetter(1))[0]
    max_nc_order = __order(lvls, maps[max_nc])
    corr_sign = {}
    corr_sign[max_nc] = 1
    for nc in numeric_columns:
        if nc == max_nc:
            continue
        nc_order = __order(lvls, maps[nc])
        corr_sign[nc] = np.sign(np.corrcoef(nc_order, max_nc_order)[0, 1])
    map = {}
    for l in lvls:
        k = str(l)
        for nc in numeric_columns:
            map[k] = map.get(k, 0) + corr_sign[nc] * corrs[nc] * maps[nc][k]
    return __norm_map(map)


def mediate(df, cat_columns, num_columns=None):
    if not isinstance(df, pd.DataFrame):
        raise RuntimeError("'df' must be a pandas DataFrame.")

    if cat_columns is None or len(cat_columns) == 0:
        return df
    if num_columns is None or len(num_columns) == 0:
        num_columns = [d for d in df.columns.values if d not in cat_columns]
    if len(num_columns) == 0:
        warnings.warn("No numeric column in data. Returns original.")
        return df
    rdf = df.copy()
    for d in cat_columns:
        map = __map_global(rdf, d, num_columns)
        rdf[d] = pd.Series([map[str(x)] for x in rdf[d]], dtype=float)
    return rdf


def __intv(map):
    sorted_map = sorted(map.items(), key=op.itemgetter(1))
    intv = {}
    prev = 0
    i = 0
    while i < len(sorted_map) - 1:
        nextintv = (sorted_map[i][1] + sorted_map[i + 1][1]) / 2
        if prev == 0:
            prev = -nextintv
        intv[str(sorted_map[i][0])] = [prev, nextintv]
        prev = nextintv
        i += 1
    intv[str(sorted_map[i][0])] = [prev, 2 - prev]
    return intv


def __normal(n, intv):
    mi, ma = intv
    u = (mi + ma) / 2
    d = (ma - mi) / 3
    samples = []
    while (len(samples) < n):
        m = n - len(samples)
        sp = [x for x in (d * np.random.randn(n) + u) if x >= mi and x <= ma]
        samples += sp
    return samples


def __uniform(n, intv):
    s = intv[1] - intv[0]
    return list(s * np.random.rand(n) + intv[0])


def __sample(serie, intv, dist):
    res = serie.copy()
    indices = {}
    samples = {}
    sp = __uniform if dist == "unif" else __normal
    counts = res.value_counts()
    for l in set(res):
        k = str(l)
        indices[k] = np.where(res == l)
        samples[k] = sp(counts[l], intv[k])
    for l in intv.keys():
        res.loc[indices[l]] = samples[l]
    return res


def mediate_unbinning(df, cat_columns, sample_dist="norm"):
    if cat_columns is None or len(cat_columns) == 0:
        return df
    num_columns = [d for d in df.columns.values if d not in cat_columns]
    if len(num_columns) == 0:
        warnings.warn("No numeric column in data. Returns original.")
        return df
    if sample_dist not in ["unif", "norm"]:
        raise RuntimeError("Unsupported 'sample_dist'.")
    md_df = df.copy()
    ub_df = df.copy()
    for d in cat_columns:
        map = __map_global(df, d, num_columns)
        md_df[d] = pd.Series([map[str(x)] for x in df[d]], dtype=float)
        intv = __intv(map)
        ub_df[d] = __sample(df[d], intv, sample_dist)
    return md_df, ub_df


def corr_matrix(df, categorical_columns=[]):
    if not isinstance(df, pd.DataFrame):
        raise RuntimeError("'df' must be a pandas DataFrame.")

    nm = df.columns.values
    n = len(nm)

    for cn in nm:
        if cn not in categorical_columns and \
                df[cn].dtype != np.float64 and \
                df[cn].dtype != np.int64:
            warnings.warn("'" + cn + "' is considered categorical.")
            categorical_columns.append(cn)
    numeric_columns = [c for c in nm if c not in categorical_columns]
    if len(numeric_columns) == 0:
        warnings.warn("No numeric column in data.")

    CM = pd.DataFrame(1, nm, nm, dtype=np.float64)
    cv_vec = {}
    for i in range(n - 1):
        for j in range(i + 1, n):
            if nm[i] in categorical_columns and \
                    nm[j] in categorical_columns:
                CM[nm[i]][nm[j]] = __cramers_v(df[nm[i]], df[nm[j]])
                CM[nm[j]][nm[i]] = CM[nm[i]][nm[j]]
            elif nm[i] not in categorical_columns and \
                    nm[j] not in categorical_columns:
                CM[nm[i]][nm[j]] = df[nm[i]].corr(df[nm[j]])
                CM[nm[j]][nm[i]] = CM[nm[i]][nm[j]]
            elif nm[i] in categorical_columns and \
                    nm[j] not in categorical_columns:
                if nm[i] not in cv_vec.keys():
                    map = __map_global(df, nm[i], numeric_columns)
                    cv_vec[nm[i]] = pd.Series([map[str(x)] for x in df[nm[i]]],
                                              dtype=np.float64)
                CM[nm[i]][nm[j]] = cv_vec[nm[i]].corr(df[nm[j]])
                CM[nm[j]][nm[i]] = CM[nm[i]][nm[j]]
            elif nm[i] not in categorical_columns and \
                    nm[j] in categorical_columns:
                if nm[j] not in cv_vec.keys():
                    map = __map_global(df, nm[j], numeric_columns)
                    cv_vec[nm[j]] = pd.Series([map[str(x)] for x in df[nm[j]]],
                                              dtype=np.float64)
                CM[nm[i]][nm[j]] = cv_vec[nm[j]].corr(df[nm[i]])
                CM[nm[j]][nm[i]] = CM[nm[i]][nm[j]]
    return CM
