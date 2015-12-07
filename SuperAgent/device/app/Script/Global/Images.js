var parameters;
var tableName;
var question;
var sku;

function AddSnapshot(objectRef, valueRef, func, title, path, noPreview) { // optional: title, path
	SetParameters();
	title = String.IsNullOrEmpty(title) ? Translate["#snapshot#"] : title;

	var isEmpty = true;
	if (String.IsNullOrEmpty(valueRef)==false){ //if not empty value
		if ((valueRef[parameters[valueRef.Metadata().TableName]])!=null && !String.IsNullOrEmpty(ToString((valueRef[parameters[valueRef.Metadata().TableName]]))))
			isEmpty = false;
	}
	if (path!=null)
		isEmpty = false;

	if (isEmpty && !$.sessionConst.galleryChoose)
		MakeSnapshot(objectRef, func);
	else{
		var listChoice = new List;
		if ($.sessionConst.galleryChoose) //if Gallery is allowed
			listChoice.Add([0, Translate["#addFromGallery#"]]);
		listChoice.Add([1, Translate["#makeSnapshot#"]]);
		if (!String.IsNullOrEmpty(path) && FileSystem.Exists(path) && (noPreview==false || noPreview==null)) //if not an Image.xml screen
			listChoice.Add([3, Translate["#show#"]]);
		if (!isEmpty && (noPreview==false || noPreview==null))
			listChoice.Add([2, Translate["#clearValue#"]]);

		//temporary, while functionality at SKU isn't full
		if (valueRef != null){
			if (valueRef.Metadata().TableName=="Catalog_SKU" && noPreview==false){
				listChoice = new List;
				listChoice.Add([3, Translate["#show#"]]);
			}
		}

		Dialog.Choose(title, listChoice, AddSnapshotHandler, [objectRef,func,valueRef, path]);
	}
}

function AddSnapshotHandler(state, args) {
	var objRef = state[0];
	var func = state[1];
	var valueRef = state[2];

	if (parseInt(args.Result)==parseInt(0)){ 	//Gallery answer
		ChooseFromGallery(objRef, func);
	}

	if (parseInt(args.Result)==parseInt(1)){ 	//SnapshotAnswer
		MakeSnapshot(objRef, func);
	}

	if (parseInt(args.Result)==parseInt(2)){ 	//Delete answer
		if (getType(valueRef)=="System.String") 	//for Questions, SKUQuestions
			DeleteFromTable(state[4], state[5]);
		else
			DeleteImage(valueRef); 		//common delete handler
	}

	if (parseInt(args.Result)==parseInt(3)){ 	//Show answer
		var path = state[3];
		var attr;
		if (getType(valueRef)=="System.String"){ 	//for Questions/SKUQuestions, callback from AddQuestionSnapshot()
			valueRef = state[4];
			attr = state[5];
		}
		else{ 		//common handler
			if (valueRef!=null)
				attr = parameters[valueRef.Metadata().TableName];
		}

		var arr = [path, valueRef, attr];
		if (valueRef != null){
			if (valueRef.Metadata().TableName=="Catalog_SKU")
				arr = [path, valueRef, attr, true];
		}

		Workflow.Action("ShowImage", arr);
	}
}

function FindImage(objectID, pictID, pictExt, filesTableName) {
	var q = new Query("SELECT FullFileName FROM " + filesTableName + " WHERE Ref = @Ref AND FileName = @FileName");
	q.AddParameter("Ref", objectID);
	q.AddParameter("FileName", pictID);
	var result = q.ExecuteScalar();
	var sh = (String.IsNullOrEmpty(result) ? "/shared/result.jpg" : Lower(result));
	return sh;
}

function SnapshotExists(objectID, pictID, filesTableName) {
	var q = new Query("SELECT FullFileName FROM " + filesTableName + " WHERE Ref = @Ref AND FileName = @FileName");
	q.AddParameter("Ref", objectID);
	q.AddParameter("FileName", pictID);
	var path = q.ExecuteScalar();
	var pathFound = !String.IsNullOrEmpty(path);
	var fileByPathExists = (pathFound ? FileSystem.Exists(path) : false);
	return pathFound && fileByPathExists;
}

function ChooseFromGallery(objRef, func) {
	FileSystem.CreateDirectory(String.Format("/private/{0}", GetParentFolderName(objRef)));

	var pictId = Global.GenerateGuid();
	var path = GetPrivateImagePath(objRef, pictId, ".jpg");
	Gallery.Size = $.sessionConst["SnapshotSize"];
	Gallery.Copy(path, func, [objRef, pictId, path]);
}

function MakeSnapshot(objRef, func) {
	FileSystem.CreateDirectory(String.Format("/private/{0}", GetParentFolderName(objRef)));

	var pictId = Global.GenerateGuid();
	var path = GetPrivateImagePath(objRef, pictId, ".jpg");
	Camera.Size = $.sessionConst["SnapshotSize"];
	Camera.Path = path;
	Camera.MakeSnapshot(path, $.sessionConst["SnapshotSize"], func, [ objRef, pictId, path]);
}

function DeleteImage(valueRef) {
	if (valueRef.IsNew()){
		DB.Delete(valueRef);
		Workflow.Refresh([]);
	}
	else{
		var index = parameters[valueRef.Metadata().TableName];
		var value = valueRef.GetObject();

		if (valueRef.Metadata().TableName == "Catalog_Outlet_Snapshots") {
			value.Deleted = true;
		} else {
			value[index] = "";
		}

		value.Save();
		Workflow.Refresh([]);
	}
}

function GetSharedImagePath(objectID, pictID, pictExt) {
	var objectType = GetParentFolderName(objectID);
	var r = "/shared/" + objectType + "/" + objectID.Id.ToString() + "/"
    + pictID + pictExt;
	return r;
}

function GetPrivateImagePath(objectID, pictID, pictExt) {
	var objectType = GetParentFolderName(objectID);
	var r = "/private/" + objectType + "/" + objectID.Id.ToString() + "/"
    + pictID + pictExt;
	return r;
}

function GetParentFolderName(entityRef) {
	var folder;

	if (getType(entityRef.Ref) == "System.String")
		folder = entityRef.Metadata().TableName;
	else{
		folder = entityRef.Ref.Metadata().TableName;
	}
	folder = StrReplace(folder, "_", ".");
	folder = Lower(folder);

	return folder;
}

function SetParameters() {
	parameters = new Dictionary();
	parameters.Add("Catalog_Outlet_Parameters", "Value");
	parameters.Add("Catalog_Outlet_Snapshots", "FileName");
	parameters.Add("Catalog_SKU", "DefaultPicture");
}


//--------------------------Alternative handlers----------------------

function AddQuestionSnapshot(tableName, question, sku, answer, previewAllowed, title, func) {
	title = String.IsNullOrEmpty(title) ? Translate["#snapshot#"] : title;
	if (String.IsNullOrEmpty(answer) && !$.sessionConst.galleryChoose)
		MakeSnapshot($.workflow.visit, func);
	else{

		if (String.IsNullOrEmpty(answer)==false)
		path = FindImage($.workflow.visit, answer, ".jpg", "Document_Visit_Files");

		var listChoice = new List;
		if ($.sessionConst.galleryChoose) //if Gallery is allowed
			listChoice.Add([0, Translate["#addFromGallery#"]]);
		listChoice.Add([1, Translate["#makeSnapshot#"]]);
		if (previewAllowed && String.IsNullOrEmpty(answer)==false && FileSystem.Exists(path)) //if not an Image.xml screen
			listChoice.Add([3, Translate["#show#"]]);
		if (String.IsNullOrEmpty(answer)==false && previewAllowed)
			listChoice.Add([2, Translate["#clearValue#"]]);

		Dialog.Choose(title, listChoice, AddSnapshotHandler, [$.workflow.visit, func, tableName, path, question, sku]);
	}
}

function DeleteFromTable(question, sku) {
	var answerString = "HistoryAnswer ";

	var tableName = sku==null ? "USR_Questions" : "USR_SKUQuestions";

	var q = new Query();

	var cond = "";
	if (tableName == "USR_SKUQuestions"){
		cond = " AND SKU=@sku";
		q.AddParameter("sku", sku);
	}

	q.Text = "UPDATE " + tableName + " SET Answer=" + answerString + ", AnswerDate=DATETIME('now', 'localtime') " +
		"WHERE Question=@question " + cond;
	q.AddParameter("answer", null);
	q.AddParameter("question", question);
	q.Execute();

	Workflow.Refresh([]);
}
