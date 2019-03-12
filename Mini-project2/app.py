from flask import Flask, render_template, url_for, request, jsonify, flash,redirect, session
from flask_pymongo import PyMongo
import pandas as pd
from io import StringIO
from utility import *
from forms import RegistrationForm,LoginForm
import json
#import pprint

import pycausal as pc


app = Flask(__name__)
# app.config["MONGO_URI"] = "mongodb://localhost:27017/causality"
app.config["SECRET_KEY"] = '80e2229aa326ca04ee982aa63b9b0f13'
# mongo = PyMongo(app)

###default route, home page
@app.route("/")   
def home():
	return render_template("index.html",title = "Home")

	
#### read the csv data to a pandas dataframe
@app.route("/read_csv", methods=['POST']) 
def read_csv():
	from sklearn.cluster import KMeans
	from sklearn.preprocessing import MinMaxScaler
	if request.method == 'POST':

		csv_file = request.get_json(force=True);		
		df = pd.read_csv(StringIO(csv_file['content']))
		print(df.head(5))
		scaler = MinMaxScaler()
		X = scaler.fit_transform(df.values)
		res = []
		for i in range(2,11):
			kmeans = KMeans(n_clusters=i, random_state=0).fit(X)
			print(kmeans.inertia_)
			res.append({"index":i,"error":kmeans.inertia_})
		
		#session['file_name'] = csv_file['name']


		return jsonify(msg="success",data=res)


@app.route("/get_sample", methods=['POST']) 
def get_sample():
	from sklearn.cluster import KMeans
	from sklearn.preprocessing import MinMaxScaler,normalize,StandardScaler
	from sklearn.utils.random import sample_without_replacement
	from sklearn.decomposition import PCA
	from sklearn.manifold import MDS
	if request.method == 'POST':

		csv_file = request.get_json(force=True);		
		df = pd.read_csv(StringIO(csv_file['content']))
		k = csv_file['k']
		print(df.head(5))
		scaler = MinMaxScaler()
		X = scaler.fit_transform(df.values)

		#session["original"] = df

		## Random Sampling
		random_ind = sample_without_replacement(len(X),int(len(X)*0.2))
		print(len(X),len(random_ind))
		random_X = []
		for i in random_ind:
			random_X.append(X[i])

		##staritified sampling
		temp_X = []
		for i in range(k):
			temp_X.append([])
		kmeans = KMeans(n_clusters=k, random_state=0).fit(X)

		for i in range(len(X)):
			temp_X[kmeans.labels_[i]].append(X[i])

		kmeans_X = []
		for i in range(k):
			print(len(temp_X[i]))
			l = len(temp_X[i])
			random_ind = sample_without_replacement(l,int(l*0.2))
			for j in random_ind:
				kmeans_X.append(temp_X[i][j])

		print(len(kmeans_X))

		session['columns'] = df.columns.tolist()
		# session['original'] = X.tolist()
		# session['random'] = np.array(random_X).tolist()
		# session['staritified'] = np.array(kmeans_X).tolist()


		pca = PCA(n_components=5)
		pca_original = pca.fit_transform(X)
		var_original = pca.explained_variance_ratio_ 
		loading_original = pca.components_
		pca_random = pca.fit_transform(random_X)
		var_random = pca.explained_variance_ratio_ 
		loading_random = pca.components_
		pca_stratified = pca.fit_transform(kmeans_X)
		var_stratified = pca.explained_variance_ratio_ 
		loading_stratified = pca.components_

		print("entering mds")
		a = np.sqrt(np.sum(np.square(loading_original), axis=0))
		# print(a)
		# print(loading_original)
		df_transformed = pd.DataFrame(np.concatenate(([a], loading_original), axis=0), columns=session['columns']).T

		print(df_transformed)

		new_df = df_transformed.sort_values(by=[0],ascending=False).iloc[:3,1:]
		print(new_df)

		embedding = MDS(n_components=2,max_iter=5)
		mds_original = embedding.fit_transform(X)
		mds_random = embedding.fit_transform(random_X)
		mds_stratified = embedding.fit_transform(kmeans_X)

		var1 = []
		var2 = []
		var3 = []

		sum1 = 0
		sum2=0
		sum3=0

		

		for i in range(len(var_original)):
			sum1 += var_original[i]
			sum2 += var_random[i]
			sum3 += var_stratified[i]
			var1.append({"index":i,"explained_variance":var_original[i], "com_sum":sum1})
			var2.append({"index":i,"explained_variance":var_random[i], "com_sum":sum2})
			var3.append({"index":i,"explained_variance":var_stratified[i],"com_sum":sum3})


		pc1 = []
		pc2 = []
		pc3 = []

		for i in range(len(pca_original)):
			pc1.append({"x":pca_original[i][0],"y":pca_original[i][1]})

		for i in range(len(pca_random)):
			pc2.append({"x":pca_random[i][0],"y":pca_random[i][1]})

		for i in range(len(pca_stratified)):
			pc3.append({"x":pca_stratified[i][0],"y":pca_stratified[i][1]})

		mds1 = []
		mds2 = []
		mds3 = []

		for i in range(len(mds_original)):
			mds1.append({"x":mds_original[i][0],"y":mds_original[i][1]})

		for i in range(len(mds_random)):
			mds2.append({"x":mds_random[i][0],"y":mds_random[i][1]})

		for i in range(len(mds_stratified)):
			mds3.append({"x":mds_stratified[i][0],"y":mds_stratified[i][1]})

		# print(loading_stratified)




		return jsonify(msg="success", columns = df.columns.tolist(),var1 = var1, var2 = var2, var3 = var3, pc1= pc1, pc2= pc2, pc3=pc3, mds1=mds1, mds2=mds2, mds3=mds3 \
			, loading_original = loading_original[:3].tolist(), loading_random=loading_random[:3].tolist(), loading_stratified =loading_stratified[:3].tolist()\
			, data1 = X.tolist(), data2 = np.array(random_X).tolist(), data3= np.array(kmeans_X).tolist())

@app.route("/get_sc_matrix", methods=['POST']) 
def get_sc_matrix():
	if request.method == 'POST':

		data = request.get_json(force=True);		
		df1 = pd.DataFrame(data['data1'],columns= session['columns'])
		df2 = pd.DataFrame(data['data2'],columns= session['columns'])
		df3 = pd.DataFrame(data['data3'],columns= session['columns'])
		print(data['attr1'])
		df1 = df1[data['attr1']]
		df2 = df2[data['attr2']]
		df3 = df3[data['attr3']]
		print(df1.head(5).to_json(orient='records'))
		# df2 = df2[data['attr2']].to_json(orient='records')
		# df3 = df3[data['attr3']].to_json(orient='records')

		# print(data['data1'])
	return jsonify(msg="success",data1 = df1.to_json(orient='records'), data2 = df2.to_json(orient='records'), data3 = df3.to_json(orient='records'),)

if __name__ == "__main__":
    app.run(port=5000, debug=True)