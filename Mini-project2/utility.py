import pandas as pd 
import numpy as np 

import pycausal as pc

### function to treat missing values in data
def miss_value_treatment(df,option):

	if option == 'delete-null':

		print("delete rows with null values")
		df = df.dropna()

		return df

## function to convert data types using binning or mediate
def convert_dtypes(df, dtypes, prep):

	for attr in df:
		print("$$$$ ", attr)
		if dtypes[attr] == 'num':
			try:
				df[attr] = df[attr].astype(float)
			except Exception as e:
				print(e)
				#raise inv.InvalidUsage("data type error", 410)
		else:
			try:
				df[attr] = df[attr].astype(str)
			except ValueError:
				raise inv.InvalidUsage("data type error", 410)

	if prep == 'mediate':
		    cats = [c for c in df.columns.values if dtypes[c] == 'cat']
		    rdf = pc.mediate(df, cats)
		    return df, rdf
		    #session['coded'] = rdf
	elif prep == 'binning':
		    nums = [c for c in df.columns.values if types[c] == 'num']
		    rdf = pc.binning(df, nums)
		    rdf, cat_code = pc.recode(rdf)
		    return df, rdf, cat_code
		    #session['coded'] = rdf
		    #session['coding'] = cat_code
	else:
		    raise inv.InvalidUsage("error data process method", 410)


def parameterize(pdag, df, selection, scaling, types):
    if scaling == "normalize":
        scale_method = pc.ScaleMethod.Normalize
    elif scaling == "standardize":
        scale_method = pc.ScaleMethod.Standardize
    else:
        scale_method = None
    # types = session['types']
    cat_dims = [c for c in df.columns.values if types[c] == 'cat']
    pdag = pc.parameterize(pdag=pdag,
                           df=df,
                           categorical_columns=cat_dims,
                           row_selection=selection,
                           scale_method=scale_method,
                           test_alter_models=True)
    return pdag

	 




