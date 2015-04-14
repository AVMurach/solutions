var snapshotsExists;
var singlePicture;
var parameterValueC;

function WarMupFunction() {

}

function OnLoading() {
	var primaryParametersSettings = new Dictionary();
	primaryParametersSettings.Add("description", "000000001");
	primaryParametersSettings.Add("address", "000000002");
	primaryParametersSettings.Add("coordinates", "000000003");
	primaryParametersSettings.Add("type", "000000004");
	primaryParametersSettings.Add("class", "000000005");
	primaryParametersSettings.Add("distributor", "000000006");
	primaryParametersSettings.Add("status", "000000007");
	primaryParametersSettings.Add("snapshots", "000000008");
	$.Add("primaryParametersSettings", primaryParametersSettings);
}

function GetOutlets(searchText) {
	var search = "";
	if (String.IsNullOrEmpty(searchText)==false) {
		searchText = StrReplace(searchText, "'", "''");
		search = "WHERE Contains(O.Description, '" + searchText + "') ";
	}
	var q = new Query("SELECT O.Id, O.Description, O.Address," +
			"(SELECT CASE WHEN COUNT(DISTINCT D.Overdue) = 2 THEN 2	WHEN COUNT(DISTINCT D.Overdue) = 0 THEN 3 " +
			"ELSE (SELECT D1.Overdue FROM Document_AccountReceivable_ReceivableDocuments D1 " +
			"JOIN Document_AccountReceivable A1 ON D1.Ref=A1.Id WHERE A1.Outlet = O.Id LIMIT 1) END AS st " +
			"FROM Document_AccountReceivable_ReceivableDocuments D JOIN Document_AccountReceivable A ON D.Ref=A.Id " +
			"WHERE A.Outlet=O.Id) AS OutletStatus"+
			" FROM Catalog_Outlet O " + search + " ORDER BY O.Description LIMIT 500");
	return q.Execute();
}

function AddGlobalAndAction(name, value, actionName) {
	if (Variables.Exists(name))
		$.Remove(name);
	$.AddGlobal(name, value);
	Workflow.Action(actionName, []);
}

function CreateOutletAndForward() {
	var p = DB.Create("Catalog.Outlet");
	p.Lattitude = 0;
	p.Longitude = 0;
	p.Save();
	var parameters = [ p ];
	Workflow.Action("Create", parameters);
}

function CreateVisitEnable() {
	if ($.sessionConst.PlanEnbl && $.workflow.name == "Outlets")
		return true;
	else
		return false;

}
function Debug(val) {
	Dialog.Debug(val);
	return true;
}


function GetOutletParameters(outlet) {
	var query = new Query();
	query.Text = "SELECT P.Id, P.Description, P.DataType, DT.Description AS TypeDescription, OP.Id AS ParameterValue, OP.Value, P.Visible, P.Editable, OP.Unavailable " +

			", CASE WHEN P.DataType=@integer OR P.DataType=@decimal OR P.DataType=@string THEN 1 ELSE 0 END AS IsInputField " + //IsInputField
			", CASE WHEN P.DataType=@integer OR P.DataType=@decimal THEN 'numeric' ELSE 'auto' END AS KeyboardType " +

			", CASE WHEN P.DataType=@integer OR P.DataType=@decimal OR P.DataType=@string THEN OP.Value " +
			"ELSE CASE " +
			"WHEN OP.Value IS NULL OR RTRIM(OP.Value)='' THEN '—' " +
			"WHEN OP.Value IS NOT NULL AND P.DataType=@snapshot THEN @attached " +
			"WHEN OP.Value IS NOT NULL AND P.DataType!=@snapshot THEN OP.Value " +
			"END END AS AnswerOutput " +

			"FROM Catalog_OutletParameter P " +
			"JOIN Enum_DataType DT ON DT.Id=P.DataType " +
			"LEFT JOIN Catalog_Outlet_Parameters OP ON OP.Parameter = P.Id AND OP.Ref = @outlet";
	query.AddParameter("integer", DB.Current.Constant.DataType.Integer);
	query.AddParameter("decimal", DB.Current.Constant.DataType.Decimal);
	query.AddParameter("string", DB.Current.Constant.DataType.String);
	query.AddParameter("snapshot", DB.Current.Constant.DataType.Snapshot);
	query.AddParameter("outlet", outlet);
	query.AddParameter("attached", Translate["#snapshotAttached#"]);
	return query.Execute();
}

function UseInput(typeDescription) {
	if (typeDescription != "Integer" && typeDescription != "Decimal" && typeDescription != "String")
		return false;
	else
		{
		if (typeDescription == "Integer" || typeDescription == "Decimal")
			$.Add("keyboardType", "numeric");
		else
			$.Add("keyboardType", "auto");
		}
		return true;
}

function GetOutletParameterValue(outlet, parameter, parameterValue, type) {
	if (type == 'Snapshot')
		return GetSnapshotText(parameterValue);
	if (parameterValue == null)
		return "";
	else
		return parameterValue.Value;
}

function GetSnapshotText(text) {
	if (String.IsNullOrEmpty(text.Value))
		return Translate["#noSnapshot#"];
	else
		return Translate["#snapshotAttached#"];
}

function CheckNotNullAndForward(outlet, visit) {
	var c = CoordsChecked(visit);
	if (CheckEmptyOutletFields(outlet) && c) {
		outlet.GetObject().Save();
		ReviseParameters(outlet, false);
		Workflow.Forward([]);
	}
}


function ReviseParameters(outlet, save) {
	var q =
			new Query("SELECT Id, Value FROM Catalog_Outlet_Parameters WHERE Ref=@ref");
	q.AddParameter("ref", outlet);
	var param =
			q.Execute();

	while (param.Next()) {
		if (save)
			param.Id.GetObject().Save(false);
	}
}


//---------------------------header parameters dialog.choose--------------------


function SelectIfNotAVisit(outlet, attribute, control, title, editOutletParameters, primaryParameterName) {
	if ($.workflow.name != "Visit") {
		DoSelect(outlet, attribute, control, title, editOutletParameters, primaryParameterName);
	}
}

function DoSelect(outlet, attribute, control, title, editOutletParameters, primaryParameterName) {
	if (IsOutletPrimaryParameterEditable(editOutletParameters, primaryParameterName)) {
		DoChoose(null, outlet, attribute, control, null, title);
	}
}


//--------------------------editing additional parameters handlers-----------------------------


function CreateOutletParameterValue(outlet, parameter, value, parameterValue) {
	var q = new Query("SELECT Id FROM Catalog_Outlet_Parameters WHERE Ref=@ref AND Parameter = @parameter");
	q.AddParameter("ref", outlet);
	q.AddParameter("parameter", parameter);
	parameterValue = q.ExecuteScalar();
	if (parameterValue == null) {
		parameterValue = DB.Create("Catalog.Outlet_Parameters");
		parameterValue.Ref = outlet;
		parameterValue.Parameter = parameter;
	} else
		parameterValue = parameterValue.GetObject();
	if ((parameter.DataType).ToString() != (DB.Current.Constant.DataType.Snapshot).ToString())
		parameterValue.Value = value;
	parameterValue.Save();
	return parameterValue.Id;
}


function AssignParameterValue(control, typeDescription, parameterValue, value, outlet, parameter){
	CreateOutletParameterValue(outlet, parameter, control.Text, parameterValue)
}

function GoToParameterAction(typeDescription, parameterValue, value, outlet, parameter, control, parameterDescription, editable) {

	if (editable) {

		if ($.sessionConst.editOutletParameters) {
			parameterValue = CreateOutletParameterValue(outlet, parameter, parameterValue, parameterValue);

			if (typeDescription == "ValueList") {  //--------ValueList-------
				var q = new Query();
				q.Text = "SELECT Value, Value FROM Catalog_OutletParameter_ValueList WHERE Ref=@ref UNION SELECT '', '—' ORDER BY Value";
				q.AddParameter("ref", parameter);
				DoChoose(q.Execute(), parameterValue, "Value", Variables[control], null, parameterDescription);
			}
			if (typeDescription == "DateTime") {  //---------DateTime-------
				if (String.IsNullOrEmpty(parameterValue.Value))
					ChooseDateTime(parameterValue, "Value", Variables[control], DateHandler, parameterDescription);
				else
					Dialog.Choose(parameterDescription, [[0, Translate["#clearValue#"]], [1, Translate["#setDate#"]]], DateHandler, [parameterValue, control]);
			}
			if (typeDescription == "Boolean") {  //----------Boolean--------
				ChooseBool(parameterValue, "Value", Variables[control], null, parameterDescription);
			}
			if (typeDescription == "Snapshot") { //----------Snapshot-------
				var listChoice = new List;
				listChoice.Add([1, Translate["#makeSnapshot#"]]);
				if ($.sessionConst.galleryChoose)
					listChoice.Add([0, Translate["#addFromGallery#"]]);
				if (String.IsNullOrEmpty(parameterValue.Value)==false)
					listChoice.Add([2, Translate["#clearValue#"]]);
				AddSnapshotGlobal(outlet, parameterValue, SaveAtOutelt, listChoice, "catalog.outlet", parameterDescription);
				parameterValueC = parameterValue;
			}
			if (typeDescription == "String" || typeDescription == "Integer" || typeDescription == "Decimal") {
				FocusOnEditText(control, '1');
			}
		}
	}
}

function IsEmptyString(value) {
	return String.IsNullOrEmpty(value);
}

function IsUnavailable(value) {
	if (value == 1 || value == null) {
		result = true;
	} else {
		result = false;
	}
	return result;
}

function IsEditText(editOutletParameters, isInputField, editable) {
	if (editOutletParameters && isInputField && editable) {
		return true;
	} else {
		return false;
	}
}

function IsOutletPrimaryParameterEditable(editOutletParameters, primaryParameterName) {
	query = new Query("SELECT Editable FROM Catalog_OutletsprimaryParametersSettings WHERE Code = @Code");
	query.AddParameter("Code", $.primaryParametersSettings[primaryParameterName]);
	isParameterEditable = query.ExecuteScalar();
	if (editOutletParameters && isParameterEditable) {
		result =  true;
	} else {
		result = false;
	};
	return result;
}

function FocusIfHasEditText(fieldName, editOutletParameters, primaryParameterName) {
	if (IsOutletPrimaryParameterEditable(editOutletParameters, primaryParameterName)) {
		FocusOnEditText(fieldName, 1);
	}
}

function DateHandler(state, args) {
	var parameterValue = state[0];
	var control = state[1];
	if(getType(args.Result)=="System.DateTime"){
		parameterValue = parameterValue.GetObject();
		parameterValue.Value = args.Result;
		parameterValue.Save();
		Workflow.Refresh([]);
	}
	if (parseInt(args.Result)==parseInt(0)){
		parameterValue = parameterValue.GetObject();
		parameterValue.Value = "";
		parameterValue.Save();
		Workflow.Refresh([]);
	}
	if (parseInt(args.Result)==parseInt(1)){
		ChooseDateTime(parameterValue, "Value", Variables[control]);
	}
}


function GetSnapshots(outlet) {
	var q = new Query("SELECT Id, FileName, LineNumber, Unavailable FROM Catalog_Outlet_Snapshots WHERE Ref=@ref AND (Deleted!='1' OR Deleted IS NULL) ORDER BY LineNumber");
	q.AddParameter("ref", outlet);
	snapshotsExists = true;
	if (parseInt(q.ExecuteCount())==parseInt(0))
		snapshotsExists = false;
	singlePicture = false;
	if (parseInt(q.ExecuteCount())==parseInt(1))
		singlePicture = true;
	return q.Execute();
}


function NoSnapshots() {
	if (snapshotsExists)
		return false;
	else
		return true;
}


function GetImagePath(objectType, objectID, pictID, pictExt) {
	var s = GetSharedImagePath(objectType, objectID, pictID, pictExt);
  return s;
}


function ImageActions(control, id) {
	if (IsOutletPrimaryParameterEditable($.sessionConst.editOutletParameters, "snapshots")) {
		Dialog.Ask(Translate["#deleteImage#"], DeleteImage, id); //Translate["#deleteImage#"]
	}
}


function DeleteImage(state, args) {
	state = state.GetObject();
	//state.FileName="";
	state.Deleted = true;
	state.Save();
	Workflow.Refresh([]);
}


function AddSnapshot(control, outlet) {
	if ($.sessionConst.galleryChoose)
		AddSnapshotGlobal(outlet, null, GalleryHandler, [[0, Translate["#addFromGallery#"]], [1, Translate["#makeSnapshot#"]]], "catalog.outlet", Translate["#outletSnapshots#"]);
	else{
		var pictId = GetCameraObject(outlet);
		var path = GetPrivateImagePath("catalog.outlet", outlet, pictId, ".jpg");
		Camera.MakeSnapshot(path, 300, GalleryHandler, [ outlet, pictId ]);
	}
}


function GalleryHandler(state, args) {
	if (args.Result){
		var outlet = state[0];
		var fileName = state[1];
		var newPicture = DB.Create("Catalog.Outlet_Snapshots");
		newPicture.Ref = outlet;
		newPicture.FileName = fileName;
		newPicture.Unavailable = true;
		newPicture.Save();

		Workflow.Refresh([]);
	}
}


// --------------------------case Visits----------------------


function CreateVisitIfNotExists(outlet, userRef, visit, planVisit) {

	if (visit == null) {
		visit = DB.Create("Document.Visit");
		if (planVisit != null)
			visit.Plan = planVisit;
		visit.Outlet = outlet;
		visit.SR = userRef;
		visit.Date = DateTime.Now;
		visit.StartTime = DateTime.Now;
		var location = GPS.CurrentLocation;
		if (location.NotEmpty) {
			visit.Lattitude = location.Latitude;
			visit.Longitude = location.Longitude;
		}
		visit.Status = DB.Current.Constant.VisitStatus.Processing;

		visit.Encashment = 0;
		visit.Save();
		return visit.Id;
	}

	return visit;
}

// -----------------------------------Coordinates--------------------------------

function SetLocation(control, outlet) {
	var location = GPS.CurrentLocation;
	if (location.NotEmpty) {
		outlet = outlet.GetObject();
		outlet.Lattitude = location.Latitude;
		outlet.Longitude = location.Longitude;
		outlet.Save();
		Workflow.Refresh([]);
	} else
		NoLocationHandler(SetLocation, outlet);
}

function HasCoordinates(outlet) {
	if (outlet == null) {
		return false;
	}
	if (!isDefault(outlet.Lattitude) && !isDefault(outlet.Longitude)) {
		return true;
	}
	return false;
}

function CoordsChecked(visit) {
	if (Variables["workflow"]["name"] == "Visit" && NotEmptyRef(visit.Plan)) {
		var query = new Query("SELECT Use FROM Catalog_MobileApplicationSettings WHERE Code='CoordCtrl'");
		var coordControl = query.ExecuteScalar();
		if (coordControl == null)
			var s = false;
		else {
			if (parseInt(coordControl) == parseInt(1))
				var s = true;
			else
				var s = false;
		}
		if (s && visit.Lattitude == null && visit.Longitude == null) {
			Dialog.Question(Translate["#impossibleToCreateVisit#"], VisitCoordsHandler, visit);
			return false;
		}
	}
	return true;
}

function VisitCoordsHandler(answ, visit) {
	visit = $.workflow.visit;
	if (answ == DialogResult.Yes) {
		var location = GPS.CurrentLocation;
		if (location.NotEmpty) {
			visit = visit.GetObject();
			visit.Lattitude = location.Latitude;
			visit.Longitude = location.Longitude;
			visit.Save();
			Dialog.Message("#coordinatesAreSet#");
		} else
			NoLocationHandler(SetLocation);
	}
}

function NoLocationHandler(descriptor) {
	Dialog.Message("#locationSetFailed#");
}

function ShowCoordOptions(control, outlet, editOutletParameters, primaryParameterName) {
	if (IsOutletPrimaryParameterEditable(editOutletParameters, primaryParameterName)) {
		Dialog.Choose("#coordinates#", [[0,Translate["#clear_coord#"]], [1,Translate["#refresh#"]], [2,Translate["#copy#"]]], ChooseHandler, outlet);
	}
}

function ChooseHandler(state, args) {
	var outlet = state;
	if (parseInt(args.Result)==parseInt(0)){
		outlet = outlet.GetObject();
		outlet.Lattitude = parseInt(0);
		outlet.Longitude = parseInt(0);
		outlet.Save();
		Workflow.Refresh([]);
	}
	if (parseInt(args.Result)==parseInt(1)){
		SetLocation(null, outlet);
	}
	if (parseInt(args.Result)==parseInt(2)){
		Clipboard.SetString(outlet.Lattitude + "; " + outlet.Longitude);
	}
}


// --------------------------- Outlets ---------------------------

function Back(outlet) {
	if (CheckEmptyOutletFields(outlet)) {
		outlet.GetObject().Save();

		Variables.Remove("outlet");
		DoBackTo("List");
	}
}

function DeleteAndRollback(visit) {
	DB.Delete(visit);
	DoRollback();
}

function SaveAndBack(outlet) {
	if (CheckEmptyOutletFields(outlet)) {
		outlet.GetObject().Save();
		ReviseParameters(outlet, true);
		if ($.Exists("outlet"))
			$.Remove("outlet");
		// DB.Commit();
		Workflow.BackTo("Outlets");
	}
}

// ---------------------------------internal------------------------

function SaveAtOutelt(arr, args) {
	if (args.Result) {
		var paramValue = parameterValueC;
		var path = arr[1];
		var question = paramValue.GetObject();
		question.Value = path;
		question.Unavailable = 1;
		question.Save();
		Workflow.Refresh([]);
	}
}

function GetCameraObject(entity) {
	FileSystem.CreateDirectory("/private/Catalog.Outlet");
	var guid = GenerateGuid();
	// Variables.Add("guid", guid);
	var path = String.Format("/private/Catalog.Outlet/{0}/{1}.jpg", entity.Id, guid);
	Camera.Size = 300;
	Camera.Path = path;
	return guid;
}

function CheckEmptyOutletFields(outlet) {
	var correctAddr = CheckIfEmpty(outlet, "Address", "", "", false);
	if (correctAddr) {
		return true;
	}
	Dialog.Message("#couldnt_be_cleaned#");
	return false;
}

function CheckIfEmpty(entity, attribute, objectType, objectName, deleteIfEmpty) {

	if (entity[attribute].Trim() == "" || String(entity[attribute]) == "0") {
		if (entity.IsNew() && ConvertToBoolean(deleteIfEmpty)) {
			DB.Current[objectType][objectName].Delete(entity);
			return true;
		} else
			return false;
	} else
		return true;
}

function CommitAndBack(){
	DB.Commit();
	Workflow.Rollback();
}

//------------------------------Temporary, from dialogs----------------

function DoChoose(listChoice, entity, attribute, control, func, title) {

	title = typeof title !== 'undefined' ? title : "#select_answer#";

	if (attribute==null)
		var startKey = control.Text;
	else
		var startKey = entity[attribute];

	if (listChoice==null){
		var tableName = entity[attribute].Metadata().TableName;
		var query = new Query();
		query.Text = "SELECT Id, Description FROM " + tableName;
		listChoice = query.Execute();
	}

	if (func == null)
		func = CallBack;

	Dialog.Choose(title, listChoice, startKey, func, [entity, attribute, control]);
}

function ChooseDateTime(entity, attribute, control, func, title) {
	var startKey;

	title = typeof title !== 'undefined' ? title : "#select_answer#";

	if (attribute==null)
		startKey = control.Text;
	else
		startKey = entity[attribute];

	if (String.IsNullOrEmpty(startKey) || startKey=="—")
		startKey = DateTime.Now;

	if (func == null)
		func = CallBack;
	Dialog.DateTime(title, startKey, func, [entity, attribute, control]);
}

function ChooseBool(entity, attribute, control, func, title) {

	title = typeof title !== 'undefined' ? title : "#select_answer#";

	if (attribute==null)
		var startKey = control.Text;
	else
		var startKey = entity[attribute];

	var listChoice = [[ "—", "—" ], [Translate["#YES#"], Translate["#YES#"]], [Translate["#NO#"], Translate["#NO#"]]];
	if (func == null)
		func = CallBack;
	Dialog.Choose(title, listChoice, startKey, func, [entity, attribute, control]);
}

function CallBack(state, args) {
	AssignDialogValue(state, args);
	var control = state[2];
	if (getType(args.Result)=="BitMobile.DbEngine.DbRef")
		control.Text = args.Result.Description;
	else
		control.Text = args.Result;
}

function AssignDialogValue(state, args) {
	var entity = state[0];
	var attribute = state[1];
	entity[attribute] = args.Result;
	entity.GetObject().Save();
	return entity;
}

//------------------------------Temporary, from global----------------

function GenerateGuid() {

	return (S4() + S4() + "-" + S4() + "-" + S4() + "-" + S4() + "-" + S4() + S4() + S4());

}

function S4() {

	return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);

}

//------------------------------Temporary, from images----------------

function AddSnapshotGlobal(objectRef, valueRef, func, listChoice, objectType, title) {
//	if ($.sessionConst.galleryChoose)
	title = typeof title !== 'undefined' ? title : "#select_answer#";
	Dialog.Choose(Translate[title], listChoice, AddSnapshotHandler, [objectRef,func,valueRef,objectType]);
//	else{
//		var pictId = GetCameraObject(objectRef);
//		var path = GetPrivateImagePath("catalog.outlet", objectRef, pictId, ".jpg");
//		Camera.MakeSnapshot(path, 300, func, [ objectRef, pictId ]);
//	}
}

function AddSnapshotHandler(state, args) {
	var objRef = state[0];
	var func = state[1];
	var valueRef = state[2];
	var objectType = state[3];

	if (parseInt(args.Result)==parseInt(0)){
		var pictId = GenerateGuid();
		var path = GetPrivateImagePath(objectType, objRef, pictId, ".jpg");
		Gallery.Size = 300;
		Gallery.Copy(path, func, [objRef, pictId]);
	}

	if (parseInt(args.Result)==parseInt(1)){
		var pictId = GetCameraObject(objRef);
		var path = GetPrivateImagePath(objectType, objRef, pictId, ".jpg");
		Camera.MakeSnapshot(path, 300, func, [ objRef, pictId]);
	}

	if (parseInt(args.Result)==parseInt(2)){
		if (valueRef.IsNew()){
			DB.Delete(valueRef);
			Workflow.Refresh([]);
		}
		else{
			var value = valueRef.GetObject();
			value.Value = "";
			value.Save();
			Workflow.Refresh([]);
		}
	}
}


function GetSharedImagePath(objectType, objectID, pictID, pictExt) {
	var r = "/shared/" + objectType + "/" + objectID.Id.ToString() + "/"
    + pictID + pictExt;
	return r;
}

function GetPrivateImagePath(objectType, objectID, pictID, pictExt) {
	var r = "/private/" + objectType + "/" + objectID.Id.ToString() + "/"
    + pictID + pictExt;
	return r;
}

function GetCameraObject(entity) {
	FileSystem.CreateDirectory("/private/Catalog.Outlet");
	var guid = GenerateGuid();
	var path = String.Format("/private/Catalog.Outlet/{0}/{1}.jpg", entity.Id, guid);
	Camera.Size = 300;
	Camera.Path = path;
	return guid;
}
