import numpy as np
from scipy.stats import norm
from pycausal import MoralGraph
from gsq.ci_tests import ci_test_dis


def __partial_corr(i, j, K, corr_matr, cut_at=0.99999999):
    if len(K) == 0:
        pr = corr_matr[i, j]
    elif len(K) == 1:
        k = K[0]
        pr = (corr_matr[i, j] - corr_matr[i, k] * corr_matr[j, k]) / \
            np.sqrt((1 - corr_matr[i, k]**2) * (1 - corr_matr[j, k]**2))
    else:
        idx = [i, j]
        idx.extend(K)
        inv_r = np.linalg.inv(corr_matr[idx, :][:, idx])
        pr = -inv_r[0, 1] / np.sqrt(inv_r[0, 0] * inv_r[1, 1])
    return min(cut_at, max(-cut_at, pr))


def __z_stat(i, j, K, corr_matr, n):
    if n - len(K) <= 3:
        raise RuntimeError("n - len(K) <= 3, too few observations.")

    pr = __partial_corr(i, j, K, corr_matr)
    z = np.sqrt(n - len(K) - 3) * abs(0.5 * np.log((1 + pr) / (1 - pr)))
    return z


def fisher_z_ci(i, j, K, corr_matr, n):
    if K is None:
        K = []
    if not type(K) is list:
        raise RuntimeError('K must be a list of integers.')
    z = __z_stat(i, j, K, corr_matr, n)
    pv = (1 - norm(0, 1).cdf(z)) * 2
    return pv


def g2_ci(i, j, K, dm):
    """Conditional independence test for discrete data.

    Args:
         i: the first node (as an integer).
         j: the second node (as an integer).
         K: the set of neibouring nodes of i and j (as a set()).
         dm: the data matrix (as a numpy.ndarray).

    Returns:
        P value of the G-squared test.
    """
    if K is None:
        K = []
    pv = ci_test_dis(dm, i, j, set(K))
    return pv


def gauss_ci_test(suffStat, i, j, K):
    return fisher_z_ci(i, j, K, suffStat['corr'], suffStat['n'])


def disc_ci_test(suffStat, i, j, K):
    return g2_ci(i, j, K, suffStat['dm'])
