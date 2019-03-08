import warnings

import numpy as np
import pandas as pd

from enum import Enum
from pycausal.corr import __map_global


def binning(df, num_columns):
    if num_columns is None or len(num_columns) == 0:
        return df
    rdf = df.copy()
    for d in num_columns:
        med = rdf[d].median()
        rdf[d] = pd.cut(rdf[d], 2, labels=["<=" + str(med), ">" + str(med)])
    return rdf


def recode(df):
    rdf = pd.DataFrame(dtype=float)
    cat_coding = {}
    for k in df.columns.values:
        tmp = pd.Categorical(df[k])
        cat_coding[k] = {}
        for i, l in enumerate(tmp.categories):
            cat_coding[k][l] = i
        rdf[k] = tmp.codes
    return rdf, cat_coding
