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
# app.config["SECRET_KEY"] = '80e2229aa326ca04ee982aa63b9b0f13'
# mongo = PyMongo(app)

###default route, home page
@app.route("/")   
def home():
	return render_template("index.html",title = "Home")

### main network page route
@app.route("/causality/<model_id>/<user>/<case>")  
def causality(model_id,user,case):
	model = mongo.db.model
	model_names = []
	if 'email' in session:
		active_models = model.find({'user':session['email']})
		
		for models in active_models:
			model_names.append(models['story_name'])
	if model_id == 'none':
		
			return render_template("causality.html",title = "Causality", model_names= model_names, flag="edit")

		# return render_template("causality.html",title = "Causality", flag="edit")

	else:
		print(model_id+"##"+user)
		active_model = model.find_one({'_id':model_id+"##"+user})
		session['current_story_data'] = active_model['data_name']
		# print(active_model['timeline'])
		if(case == "0"):
			return render_template("causality.html",title = "Causality", flag="show", timeline=active_model['timeline'], story_text=active_model['story_text'], author= user, active_model= json.dumps(active_model['model']),model_name= active_model['story_name'] )
		else:
			return render_template("causality.html",title = "Causality", flag="edit", model_names=model_names, author=user, case="1", active_model= json.dumps(active_model['model']),model_name= active_model['story_name'] )

	
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
	from sklearn.preprocessing import MinMaxScaler
	from sklearn.utils.random import sample_without_replacement
	from sklearn.decomposition import PCA
	if request.method == 'POST':

		csv_file = request.get_json(force=True);		
		df = pd.read_csv(StringIO(csv_file['content']))
		k = csv_file['k']
		print(df.head(5))
		scaler = MinMaxScaler()
		X = scaler.fit_transform(df.values)

		## Random Sampling
		random_ind = sample_without_replacement(len(X),int(len(X)*0.5))
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
			random_ind = sample_without_replacement(l,int(l*0.5))
			for j in random_ind:
				kmeans_X.append(temp_X[i][j])

		print(len(kmeans_X))

		pca = PCA(n_components=10)
		pca_original = pca.fit_transform(X)
		var_original = pca.explained_variance_ratio_ 
		pca_random = pca.fit_transform(random_X)
		var_random = pca.explained_variance_ratio_ 
		pca_stratified = pca.fit_transform(kmeans_X)
		var_stratified = pca.explained_variance_ratio_ 

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

		# print(var1)
		

		


		# res = []
		# for i in range(2,11):
		# 	kmeans = KMeans(n_clusters=i, random_state=0).fit(X)
		# 	print(kmeans.inertia_)
		# 	res.append({"index":i,"error":kmeans.inertia_})
		
		#session['file_name'] = csv_file['name']


		return jsonify(msg="success",var1 = var1, var2 = var2, var3 = var3 )
	    
#preprocess csv file, setup dtypes, binning or mediate
@app.route("/show_dag",methods=['POST'])
def preprocess():
	if request.method == 'POST':

		alpha = 0.01
		scaling = "normalize"
		selection = None

		#get the json data from view
		json_data = request.get_json(force=True)
		data = mongo.db.data
		
		csv_data = data.find_one({'_id': json_data['name'] })

		df = pd.DataFrame(csv_data['csv_data'], columns=csv_data['attributes'])
		
		#print(json_data['keys'],json_data['name'])
		#print("$$$$$$$$$ "+json_data['attr'])
		#find the file in database
		if('pdag' in json_data):
			pdag = json_data['pdag']
			pdag = pc.PDAG.from_obj(pdag)
			dtypes = csv_data['attr_types']
			
		else:
			data.update_one({'_id':json_data['name']},{'$set':{'key': json_data['keys'],'attr_types':json_data['attr_types']}},upsert=False)
			dtypes = json_data['attr_types']
			

			df = miss_value_treatment(df,json_data['miss_val_prep'])
			response = convert_dtypes(df,dtypes, json_data['dtype_prep'])
			#print(len(response))
			#print(df.dtypes)

			
			
			## learn the causal model structure/edges
			rdf = response[1]
			if json_data['dtype_prep'] == 'mediate':
			    pdag = pc.learn_causal_pdag_tc(df=rdf,
			                                   alpha=alpha,
			                                   verbose=False)
			elif json_data['dtype_prep'] == 'binning':
			    pdag = pc.learn_causal_pdag_pc(rdf, 'cat', alpha=alpha, verbose=True)
			
		### estimate the weights of the edges by regression
		pdag = parameterize(pdag=pdag,
		                    df=df,
		                    selection=selection,
		                    scaling=scaling,
		                    types=dtypes)
		print("######################")
		#print(pdag.to_json())
		return jsonify({'model': pdag.to_json()})
		
		# return jsonify(message="success"), 200

@app.route("/augment_story",methods=['POST'])
def augment_story():

	#get the json data from view
	json_data = request.get_json(force=True)
	#print(json_data['keys'],json_data['name'])
	#print("$$$$$$$$$ "+json_data['attr'])
	#find the file in database
	data = mongo.db.data
	df1 = data.find_one({'_id': json_data['name'] })

	df_left = pd.DataFrame(df1['csv_data'], columns=json_data['attr'])
	dtypes = json_data['attr_types']

	df_left = miss_value_treatment(df_left,json_data['miss_val_prep'])
	response = convert_dtypes(df_left,dtypes, json_data['dtype_prep'])
	df_left = response[0]

	df2 = data.find_one({'_id': session['current_story_data'] })

	df_right = pd.DataFrame(df2['csv_data'], columns=df2['attributes'])
	# dtypes = json_data['attr_types']

	# df1 = miss_value_treatment(df1,json_data['miss_val_prep'])
	# response = convert_dtypes(df1,dtypes, json_data['dtype_prep'])
	#df1 = response[0]
	# df_left[json_data['keys'][0]] = df_left[json_data['keys'][0]].str.strip('[^A-Za-z0-9]+');
	# df_right[df2['key'][0]] = df_right[df2['key'][0]].str.strip('[^A-Za-z0-9]+');

	# df_left.to_csv("left.csv",index=False)
	# df_right.to_csv("right.csv",index=False)

	merged = pd.merge(df_left, df_right, left_on=json_data['keys'], right_on=df2['key'])
	dtypes.update(df2['attr_types'])
	
	del dtypes[df2['key'][0]]
	print(dtypes)
	if(json_data['keys'] != df2['key']):
		merged = merged.drop(df2['key'],axis=1)

	merged.to_csv("merged.csv",index=False)
	print("%%%%%%%%%%%%%%%%%%%%%%")
	print(merged.columns)
	df = miss_value_treatment(merged,json_data['miss_val_prep'])
	print("%%%%%%%%%%%%%%%%%%%%%%")
	print(df.columns)
	response = convert_dtypes(df,dtypes, json_data['dtype_prep'])
	#print(len(response))
	#print(df.dtypes)

	alpha = 0.01
	scaling = "normalize"
	selection = None
	
	## learn the causal model structure/edges
	rdf = response[1]
	if json_data['dtype_prep'] == 'mediate':
	    pdag = pc.learn_causal_pdag_tc(df=rdf,
	                                   alpha=alpha,
	                                   verbose=False)
	elif json_data['dtype_prep'] == 'binning':
	    pdag = pc.learn_causal_pdag_pc(rdf, 'cat', alpha=alpha, verbose=True)
	
	### estimate the weights of the edges by regression
	pdag = parameterize(pdag=pdag,
	                    df=df,
	                    selection=selection,
	                    scaling=scaling,
	                    types=dtypes)
	print("######################")
	#print(pdag.to_json())
	return jsonify({'model': pdag.to_json()})

	return jsonify({"msg":"augmented"})

@app.route("/show_saved_model",methods=['POST'])
def show_saved_model():
	if request.method == 'POST':

		#get the json data from view
		json_data = request.get_json(force=True)

		#find the file in database
		print(json_data['name'])
		model = mongo.db.model
		data = model.find_one({'_id': json_data['name']+"##"+session['email'] })
		pdag = data['model']
		#print(pdag)
		session['model_name'] = json_data['name']
		
		return jsonify({'model': json.dumps(pdag), 'data_name': data['data_name']})

		# return jsonify(message="success"), 200

@app.route("/save_model", methods=['GET', 'POST'])
def save_model():
	try:
		model = mongo.db.model
		json_data = request.get_json(force=True)
		saved_models = json_data['timeline']
		text = json_data['text']
		model.insert_one({'_id':json_data['name']+"##"+session['email'],'story_text':text,'data_name':json_data['data_name'] ,'model':json_data['content'],'user':session['email'],'category':json_data['category'], 'publish':'False','story_name':json_data['name'],'timeline':saved_models})
		flash(f'succesfully Saved the model !!!', 'success')
		session['model_name'] = json_data['name']
		return jsonify(msg="succes")
	except Exception as e:
		flash(f'Cant Save the model !!!', 'danger')
		

	return jsonify(msg="failure")



@app.route("/publish_model", methods=['GET', 'POST'])
def publish_model():
	try:
		model = mongo.db.model
		json_data = request.get_json(force=True)
		model.update_one({'_id':session['model_name']+"##"+session['email']},{'$set':{'publish': 'True'}},upsert=False)
		flash(f'succesfully Saved the model !!!', 'success')
		return jsonify(msg="succes")
	except Exception as e:
		flash(f'Cant Save the model !!!', 'danger')
		

	return jsonify(msg="failure")
		

@app.route("/register", methods=['GET', 'POST'])
def register():
	form = RegistrationForm()
	if form.validate_on_submit():
		try:
			user = mongo.db.user
			user.insert_one({'_id': form.email.data, 'password': form.password.data})
			session['email'] = form.email.data
		except Exception as e:
			#print(e)
			flash(f'User Already exists!!!', 'primary')
			return redirect(url_for('register'))


		flash(f'Account created for {form.email.data}!', 'success')
		return redirect(url_for('home'))
	return render_template('register.html', title='Register', form=form)
    


@app.route("/login", methods=['GET', 'POST'])
def login():
	form = LoginForm()
	if form.validate_on_submit():
		user_dict = mongo.db.user
		user = user_dict.find_one({'_id': form.email.data})
		if user and form.password.data == user['password']:
			session['email'] = form.email.data
			flash('You have been logged in!', 'success')
			return redirect(url_for('home'))
		else:
			flash('Login Unsuccessful. Please check username and password', 'danger')
	return render_template('login.html', title='Login', form=form)

@app.route("/logout")
def logout():
	session.pop("email",None)
	return redirect(url_for('home'))


@app.route('/story_list/<category>')
def story_list(category):

	model = mongo.db.model
	stories = model.find({'category': category, 'publish':'True'})
	session['category'] = category
	story_widget = []
	i=1
	for story in stories:
		story_widget.append({'user':story['user'],'name':story['story_name'] })
		i += 1

	print(story_widget)


	return render_template('story_list.html', title='Stories', category=category, stories= story_widget)

@app.route('/timeline/')
def timeline():
	return render_template('timeline.html')


if __name__ == "__main__":
    app.run(port=5000, debug=True)