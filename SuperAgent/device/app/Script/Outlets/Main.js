var snapshotsExists;
var singlePicture;
var parameterValueC;

function GetOutlets(searchText) {
	var search = "";
	if (String.IsNullOrEmpty(searchText)==false)
		search = "WHERE Contains(O.Description, '" + searchText + "') ";
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

function GetOutletParameters(outlet) {
	var query = new Query();
	query.Text = "SELECT P.Id, P.Description, P.DataType, DT.Description AS TypeDescription, OP.Id AS ParameterValue, OP.Value FROM Catalog_OutletParameter P JOIN Enum_DataType DT ON DT.Id=P.DataType LEFT JOIN Catalog_Outlet_Parameters OP ON OP.Parameter = P.Id AND OP.Ref = @outlet";
	query.AddParameter("outlet", outlet);
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
//		parameterValue.Value = "";
//	else
		parameterValue.Value = value;
	parameterValue.Save();
	return parameterValue.Id;
}


function GetSnapshotText(text) {
	if (String.IsNullOrEmpty(text.Value))
		return Translate["#noSnapshot#"];
	else
		return Translate["#snapshotAttached#"];
}

function SelectIfNotAVisit(outlet, attribute, entity) {
	if ($.workflow.name != "Visit")
		DoSelect(outlet, attribute, entity);
}

function GoToParameterAction(typeDescription, parameterValue, value, outlet, parameter, control) {
	
	if ($.sessionConst.editOutletParameters){
	
		parameterValue = CreateOutletParameterValue(outlet, parameter, Variables[control].Text, parameterValue);
		
		if (typeDescription == "ValueList") {
			var q = new Query();
			q.Text = "SELECT Value, Value FROM Catalog_OutletParameter_ValueList WHERE Ref=@ref UNION SELECT '', '—' ORDER BY Value";
			q.AddParameter("ref", parameter);
			ValueListSelect(parameterValue, "Value", q.Execute(), Variables[control]);
		}
		if (typeDescription == "DateTime") {
			if (String.IsNullOrEmpty(parameterValue.Value))
				DateTimeDialog(parameterValue, "Value", parameterValue.Value, Variables[control]);
			else
				Dialog.Choose(Translate["#valueList#"], [[0, Translate["#clearValue#"]], [1, Translate["#setDate#"]]], DateHandler, [parameterValue, control]);		
		}
		if (typeDescription == "Boolean") {
			BooleanDialogSelect(parameterValue, "Value", Variables[control]);
		}
		if (typeDescription == "Snapshot") {
			var listChoice = new List;
			listChoice.Add([1, Translate["#makeSnapshot#"]]);
			if ($.sessionConst.galleryChoose)
				listChoice.Add([0, Translate["#addFromGallery#"]]);
			if (String.IsNullOrEmpty(parameterValue.Value)==false)
				listChoice.Add([2, Translate["#clearValue#"]]);
			Gallery.AddSnapshot(outlet, parameterValue, SaveAtOutelt, listChoice, "catalog.outlet");
			parameterValueC = parameterValue;		
		}
	}
}

function DateHandler(state, args) {
	var parameterValue = state[0];
	var control = state[1];
	if (parseInt(args.Result)==parseInt(0)){
		parameterValue = parameterValue.GetObject();
		parameterValue.Value = "";
		parameterValue.Save();
		Workflow.Refresh([]);
	}
	if (parseInt(args.Result)==parseInt(1)){
		DateTimeDialog(parameterValue, "Value", parameterValue.Value, Variables[control]);
	}	
}

function AssignParameterValue(control, typeDescription, parameterValue, value, outlet, parameter){
	CreateOutletParameterValue(outlet, parameter, control.Text, parameterValue)
}

function GetLookupList(entity, attribute) {
	var tableName = entity[attribute].Metadata().TableName;
	var query = new Query();
	query.Text = "SELECT Id, Description FROM " + tableName;
	return query.Execute();
}

function UpdateValueAndBack(entity, attribute, value) {
	if (attribute != "Answer" && attribute != "Value") { // for
		// Visit_Questions
		entity[attribute] = value;
		if (attribute == "PriceList") {
			var n = CountEntities("Document", "Order_SKUs", Variables["workflow"]["order"].Id, "Ref");
			if (parseInt(n) != parseInt(0))
				Dialog.Message("#SKUWillRevised#");
		}
	} else {
		entity[attribute] = value.Value;
	}

	Workflow.Back();
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
		// if (String.IsNullOrEmpty(param.Value))
		// DB.Delete(param.Id);
		// else {
		if (save)
			param.Id.GetObject().Save(false);
	}
	//	}
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
	if ($.sessionConst.editOutletParameters)
		Dialog.Ask(Translate["#deleteImage#"], DeleteImage, id); //Translate["#deleteImage#"]
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
		Gallery.AddSnapshot(outlet, null, GalleryHandler, [[0, Translate["#addFromGallery#"]], [1, Translate["#makeSnapshot#"]]], "catalog.outlet");
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

function ShowCoordOptions(control, outlet) {
	Dialog.Choose("#select_answer#", [[0,Translate["#clear_coord#"]], [1,Translate["#refresh#"]], [2,Translate["#copy#"]]], ChooseHandler, outlet);
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
		question.Save();
		Workflow.Refresh([]);
	}
}

function GetCameraObject(entity) {
	FileSystem.CreateDirectory("/private/Catalog.Outlet");
	var guid = Global.GenerateGuid();
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

function DialogCallBack(control, key) {
	Workflow.Refresh([]);
}

//AVMurach+
function SaveAndDoAction(SelectDistr, outlet) {
	
	if (Variables.Exists("outletFromDistr"))
	$.Remove("outletFromDistr");
	$.AddGlobal("outletFromDistr", outlet);
		
	var parameters = [ outlet ];
	Workflow.Action(SelectDistr, parameters);
}
//AVMurach-