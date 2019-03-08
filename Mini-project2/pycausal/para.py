import warnings

import numpy as np
import pandas as pd
# from sklearn.preprocessing import MinMaxScaler, StandardScaler
from statsmodels.api import OLS, Logit, MNLogit
# from statsmodels.formula.api import logit, mnlogit, ols

from enum import Enum
from pycausal import PDAG, Edge, EdgeType, Vertex, VertexDataType


class ScaleMethod(Enum):
    Standardize, Normalize = range(2)


class ScoreMethod(Enum):
    BIC, AIC = range(2)


def __bic(f):
    return f.bic


def __aic(f):
    return __aic


def causes_of(v_name, edges):
    c = set()
    for e in edges:
        if e.direct_type == EdgeType.Directed.name and e.v2.name == v_name:
            c.add(e.v1.name)
    return sorted(list(c))


def build_model(**kwargs):
    model = {}
    for k, v in kwargs.items():
        model[k] = v
    return model


def parameterize(pdag,
                 df,
                 categorical_columns=[],
                 row_selection=None,
                 scale_method=None,
                 score_method=ScoreMethod.BIC,
                 test_alter_models=False,
                 verbose=False):
    if not isinstance(pdag, PDAG):
        raise RuntimeError("'pdag' must be an instance of PDAG class.")

    if not isinstance(df, pd.DataFrame):
        raise RuntimeError("'df' must be a pandas DataFrame.")

    if df.shape[1] < len(pdag.vertices):
        raise RuntimeError("Number of column is smaler than number of vertex.")

    if scale_method is not None and not isinstance(scale_method, ScaleMethod):
        raise RuntimeError("Invalid 'scale_method' value.")

    if not isinstance(score_method, ScoreMethod):
        raise RuntimeError("Invalid 'score_method'.")

    # drop NA values
    if df.isnull().values.any():
        warnings.warn("Records with missing values are removed.")
        df = df.dropna()

    # return pdag if it is a correlation graph
    if hasattr(pdag, 'type'):
        if pdag.type == "correlation":
            return pdag

    # detect un-selected categorical columns
    for cn in list(df):
        if cn not in categorical_columns and \
                df[cn].dtype not in [np.float64, np.int64,
                                     np.float32, np.int32]:
            warnings.warn("'" + cn + "' is considered categorical.")
            categorical_columns.append(cn)
    # levels of categorical columns
    levels = {}
    for cn in categorical_columns:
        levels[cn] = sorted(list(set(df[cn])))

    # scale numeric columns if necessary
    names = list(df.columns.values)
    if scale_method == ScaleMethod.Normalize:
        for nm in names:
            if nm not in categorical_columns:
                df[nm] = (df[nm] - df[nm].min()) / \
                    (df[nm].max() - df[nm].min())
    elif scale_method == ScaleMethod.Standardize:
        for nm in names:
            if nm not in categorical_columns:
                df[nm] = (df[nm] - df[nm].mean()) / df[nm].std()

    # row selection
    if row_selection is not None and len(row_selection) == df.shape[0]:
        df = df.loc[row_selection, :]

    # create the result pdag initilialized with all nodes and undirected edges
    new_pdag = PDAG(pdag.title)
    for v in pdag.vertices:
        new_pdag.add_vertex(Vertex(v.id, v.name, VertexDataType.Unset))
    for e in pdag.edges:
        if e.direct_type == EdgeType.Nondirected.name:
            new_pdag.add_edge(e.v1.id, e.v2.id, EdgeType.Nondirected)
    # for k, v in pdag.__dict__.items():
    #     if k not in PDAG.fields and k != "models":
    #         new_pdag[k] = v

    # model score
    score = __bic if score_method == ScoreMethod.BIC else __aic
    model_score = 0
    models = []

    # let the party begin
    for v in pdag.vertices:
        new_v = new_pdag.get_vertex_by_name(v.name)
        if v.name in categorical_columns:
            new_v.data_type = VertexDataType.Categorical.name
        else:
            new_v.data_type = VertexDataType.Numeric.name

        cause_names = causes_of(v.name, pdag.edges)
        new_v.causes = cause_names      # adding causes attribute to new_v

        if len(cause_names) == 0:
            # fit to null model and calculate aic/bic
            formula = v.name + " ~ 1"
            print(formula)
            if verbose:
                print(formula)
            if v.name not in categorical_columns:
                mod = OLS.from_formula(formula=formula, data=df)
                res = mod.fit()
                model_score += score(res)
            else:
                mod = MNLogit.from_formula(formula=formula, data=df)
                res = mod.fit()
                model_score += score(res)
        else:
            # fit model with ols, logit, or mnlogit
            # generate formula
            indp = []
            for nm in cause_names:
                if nm in categorical_columns:
                    indp.append("C(" + nm + ")")
                else:
                    indp.append(nm)
            formula = v.name + " ~ " + " + ".join(indp) + " + 1"
            if verbose:
                print(formula)

            if v.name not in categorical_columns:
                # linear regression w/ ols
                mod = OLS.from_formula(formula=formula, data=df)
                res = mod.fit()
                model_score += score(res)
                new_v.model_type = "linear"
                # assign model parameters to new vertex
                new_v.fvalue = res.fvalue
                new_v.f_pvalue = res.f_pvalue 
                new_v.rsquared = res.rsquared
                new_v.rsquared_adj = res.rsquared_adj
                new_v.model_score = score(res)
                # assign model coefficients to edges
                tvalues = res.tvalues.to_dict()
                pvalues = res.pvalues.to_dict()
                bse = res.bse.to_dict()
                params = res.params.to_dict()
                conf_int = res.conf_int().to_dict(orient="index")
                new_v.const = {"beta": params["Intercept"],
                               "se": bse["Intercept"],
                               "tvalue": tvalues["Intercept"],
                               "pvalue": pvalues["Intercept"],
                               "conf_int": list(conf_int["Intercept"].values())
                               }
                for nm in cause_names:
                    new_v2 = new_pdag.get_vertex_by_name(nm)
                    if nm in categorical_columns:
                        # categorical regressor
                        lvls = levels[nm][1:]
                        ref_level = levels[nm][0]
                        for lvl in lvls:
                            lnm = "C(" + nm + ")[T." + str(lvl) + "]"
                            new_edge = Edge(new_v2, new_v, EdgeType.Directed)
                            new_edge.beta = params[lnm]
                            new_edge.se = bse[lnm]
                            new_edge.tvalue = tvalues[lnm]
                            new_edge.pvalue = pvalues[lnm]
                            new_edge.conf_int = list(conf_int[lnm].values())
                            new_edge.ref_level = ref_level
                            new_edge.level = lvl
                            new_pdag.edges.append(new_edge)
                    else:
                        # numeric regressor
                        new_edge = Edge(new_v2, new_v, EdgeType.Directed)
                        new_edge.beta = params[nm]
                        new_edge.se = bse[nm]
                        new_edge.tvalue = tvalues[nm]
                        new_edge.pvalue = pvalues[nm]
                        new_edge.conf_int = list(conf_int[nm].values())
                        new_pdag.edges.append(new_edge)
                models.append(
                    build_model(
                        dependent=v.name,
                        independents=indp,
                        regressors=cause_names,
                        model='linear',
                        rsquared=res.rsquared,
                        rsquared_adj=res.rsquared_adj,
                        fvalue=res.fvalue,
                        f_pvalue=res.f_pvalue,
                        score=score(res),
                        betas=params,
                        tvalues=tvalues,
                        pvalues=pvalues,
                        se=bse,
                        conf_int=conf_int
                        ))
            else:
                # multi-nomial logistic regression w/ mnlogit
                mod = MNLogit.from_formula(formula=formula, data=df)
                res = mod.fit()
                model_score += score(res)
                new_v.model_type = "mnlogit"
                new_v.levels = levels[v.name]
                # assign model parameters to new vertex
                new_v.ll = res.llf
                new_v.llr = res.llr
                new_v.llr_pvalue = res.llr_pvalue
                new_v.rsquared_pseudo = res.prsquared
                new_v.model_score = score(res)
                # assign model coefficients to edges
                tvalues = res.tvalues.to_dict(orient='index')
                pvalues = res.pvalues.to_dict(orient='index')
                bse = res.bse.to_dict(orient='index')
                params = res.params.to_dict(orient='index')
                new_v.const = {}
                for l in range(0, len(levels[v.name]) - 1):
                    new_v.const[levels[v.name][l + 1]] = {
                        "beta": params["Intercept"][l],
                        "se": bse["Intercept"][l],
                        "tvalue": tvalues["Intercept"][l],
                        "pvalue": pvalues["Intercept"][l]
                    }
                    # for each level of target variable v/_new
                    for nm in cause_names:
                        new_v2 = new_pdag.get_vertex_by_name(nm)
                        if nm in categorical_columns:
                            # categorical regression
                            lvls = levels[nm][1:]
                            ref_level = levels[nm][0]
                            for lvl in lvls:
                                lnm = "C(" + nm + ")[T." + str(lvl) + "]"
                                new_edge = Edge(new_v2, new_v,
                                                EdgeType.Directed)
                                new_edge.beta = params[lnm][l]
                                new_edge.se = bse[lnm][l]
                                new_edge.tvalue = tvalues[lnm][l]
                                new_edge.pvalue = pvalues[lnm][l]
                                new_edge.ref_level = ref_level
                                new_edge.level = lvl
                                new_edge.tar_level = levels[v.name][l + 1]
                                new_pdag.edges.append(new_edge)
                        else:
                            # numeric regression
                            new_edge = Edge(new_v2, new_v, EdgeType.Directed)
                            new_edge.beta = params[nm][l]
                            new_edge.se = bse[nm][l]
                            new_edge.tvalue = tvalues[nm][l]
                            new_edge.pvalue = pvalues[nm][l]
                            new_edge.tar_level = levels[v.name][l + 1]
                            new_pdag.edges.append(new_edge)
                models.append(
                    build_model(
                        dependent=v.name,
                        independents=indp,
                        regressors=cause_names,
                        model='mnlogit',
                        ll=res.llf,
                        llr=res.llr,
                        llr_pvalue=res.llr_pvalue,
                        rsquared_pseudo=res.prsquared,
                        score=score(res),
                        betas=params,
                        tvalues=tvalues,
                        pvalues=pvalues,
                        se=bse
                        ))

    new_pdag.models = models
    new_pdag.score_method = score_method.name
    new_pdag.score = model_score

    new_pdag.parameterized = True

    if test_alter_models:
        check_alter_models(new_pdag, df, score_method)

    return new_pdag


def check_alter_models(pdag, df, score_method=ScoreMethod.BIC):
    if not isinstance(pdag, PDAG):
        raise RuntimeError("'pdag' must be an instance of PDAG class.")
    elif pdag.parameterized is None or not pdag.parameterized:
        raise RuntimeError("'pdag' has to be parameterized first.")

    if not isinstance(df, pd.DataFrame):
        raise RuntimeError("'df' must be a pandas DataFrame.")

    if not isinstance(score_method, ScoreMethod):
        raise RuntimeError("Invalid 'score_method'.")

    score = __bic if score_method == ScoreMethod.BIC else __aic

    for model in pdag.models:
        dep = model["dependent"]
        indeps = model["independents"]
        vars = model["regressors"]
        for ind, v in zip(indeps, vars):
            # for each alternative model remove one indep
            alter = [x for x in indeps if x != ind]
            if len(alter) == 0:
                formula = dep + " ~ 1"
            else:
                formula = dep + " ~ " + " + ".join(alter)
            # fit the alternative model
            if model["model"] == "linear":
                mod = OLS.from_formula(formula=formula, data=df)
            # elif model["model"] == "logit":
            #     mod = Logit.from_formula(formula=formula, data=df)
            elif model["model"] == "mnlogit":
                mod = MNLogit.from_formula(formula=formula, data=df)
            else:
                raise RuntimeError("Invalid model '" + model["model"] + "'.")
            delta = score(mod.fit()) - model["score"]
            # assign delta to all corresponding edges
            edges = pdag.get_edge(v, dep, get_all=True)
            for ed in edges:
                ed.delta_score = delta
