var snapshotsExists;
var singlePicture;
var parameterValueC;
var title;

//"description"	= "000000001"
//"address"			= "000000002"
//"coordinates" = "000000003"
//"type"				= "000000004"
//"class"				= "000000005"
//"distributor" = "000000006"
//"status"			= "000000007"
//"snapshots"		= "000000008"

function OnLoading() {

	query = new Query("SELECT Editable, Code FROM Catalog_OutletsPrimaryParametersSettings");

	parameterList = query.Execute();

	var primaryParametersSettings = new Dictionary();

	while (parameterList.Next()) {

		primaryParametersSettings.Add(parameterList.Code, parameterList.Editable);

	}

	$.Add("primaryParametersSettings", primaryParametersSettings);

	title = Translate["#outlet#"];

}

function HasMenu(){

	return GlobalWorkflow.GetMenuItem() == "Outlets" ? true : false;
}

function GetOutlets(searchText) {
	var search = "";
	var showOutlet = "";
	var createOrder ="";
	var createReturn = "";
	var outletStatus = "";
	var q = new Query();

	if (String.IsNullOrEmpty(searchText)==false) { //search processing
		searchText = StrReplace(searchText, "'", "''");
		search = "WHERE Contains(O.Description, '" + searchText + "') ";
	}
	
	var currentDoc = GlobalWorkflow.GetMenuItem();

	if (currentDoc=="Outlets") {  //ShowOutletInMA for Outlets.xml at Outlets workflow
		showOutlet = " JOIN Catalog_OutletsStatusesSettings OS ON OS.Status=O.OutletStatus AND ShowOutletInMA=1 ";
	}

	if (currentDoc=="Orders") {  //CreateOrderInMA for Outlets.xml at Order workflow
		createOrder = " JOIN Catalog_OutletsStatusesSettings OS ON OS.Status=O.OutletStatus AND CreateOrderInMA=1 ";
	}

	if (currentDoc=="Returns"){
		createReturn = " JOIN Catalog_OutletsStatusesSettings OS ON OS.Status=O.OutletStatus AND CreateReturnInMA=1 ";
	}

	if ($.sessionConst.encashEnabled){
		outletStatus = "(SELECT CASE WHEN COUNT(DISTINCT D.Overdue) = 2 THEN 2	WHEN COUNT(DISTINCT D.Overdue) = 0 THEN 3 " +
		"ELSE (SELECT D1.Overdue FROM Document_AccountReceivable_ReceivableDocuments D1 " +
		"JOIN Document_AccountReceivable A1 ON D1.Ref=A1.Id WHERE A1.Outlet = O.Id LIMIT 1) END AS st " +
		"FROM Document_AccountReceivable_ReceivableDocuments D JOIN Document_AccountReceivable A ON D.Ref=A.Id " +
		"WHERE A.Outlet=O.Id) AS OutletStatus";
	}
	else
		outletStatus = " 3 AS OutletStatus";

	q.Text = "SELECT O.Id, O.Description, O.Address, 'main_row' AS Style, " + outletStatus +
		" FROM Catalog_Outlet O " +
		showOutlet + createOrder + createReturn + search + " ORDER BY O.Description LIMIT 500";

	return q.Execute();
}

function AddGlobalAndAction(outlet) {

	var actionName = "";
	var curr = GlobalWorkflow.GetMenuItem();

	if (curr=="Outlets")
		actionName = "Select";
	else{
		if (HasContractors(outlet)){
			if (curr == "Orders")
				actionName = "CreateOrder";
			if (curr == "Returns")
				actionName = "CreateReturn";
		}
		else{
			Dialog.Message(Translate["#noContractorsMessage#"]);
		}
	}

	if (actionName != ""){
		GlobalWorkflow.SetOutlet(outlet);
		Workflow.Action(actionName, []);
	}

}

function GetOutletObject(){
	if (!$.Exists("outlet"))
		$.AddGlobal("outlet", GlobalWorkflow.GetOutlet());
	return GetObject($.outlet);
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
	if ($.sessionConst.PlanEnbl && $.workflow.name == "Outlet")
		return true;
	else
		return false;

}

function CreateOutletEnabled(){
	if (GlobalWorkflow.GetMenuItem() == "Outlets")
		return true;
	else
		return false;

}

function GetOutletParameters(outlet) {

	var query = new Query();

	query.Text = "SELECT P.Id, P.Description, P.DataType, DT.Description AS TypeDescription, OP.Id AS ParameterValue, OP.Value, P.Visible, P.Editable " +
			", CASE WHEN P.DataType=@integer OR P.DataType=@decimal OR P.DataType=@string THEN 1 ELSE 0 END AS IsInputField " + //IsInputField
			", CASE WHEN P.DataType=@integer OR P.DataType=@decimal THEN 'numeric' ELSE 'auto' END AS KeyboardType " +
			", CASE WHEN P.DataType=@integer OR P.DataType=@decimal OR P.DataType=@string THEN OP.Value " +
					"ELSE CASE WHEN OP.Value IS NULL OR RTRIM(OP.Value)='' THEN '—' " +
										"WHEN OP.Value IS NOT NULL AND P.DataType=@snapshot THEN @attached " +
										"WHEN OP.Value IS NOT NULL AND P.DataType!=@snapshot THEN OP.Value " +
					"END END AS AnswerOutput " +
			", CASE WHEN P.DataType=@snapshot THEN " +
					"CASE WHEN TRIM(IFNULL(OFILES.FullFileName, '')) != '' THEN LOWER(OFILES.FullFileName) ELSE '/shared/result.jpg' END ELSE NULL END AS FullFileName " +
			"FROM Catalog_OutletParameter P " +
			"JOIN Enum_DataType DT ON DT.Id=P.DataType " +
			"LEFT JOIN Catalog_Outlet_Parameters OP ON OP.Parameter = P.Id AND OP.Ref = @outlet " +
			"LEFT JOIN Catalog_Outlet_Files OFILES ON OP.Value = OFILES.FileName AND OFILES.Ref = @outlet";

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
		if (editOutletParameters && $.primaryParametersSettings[primaryParameterName]) {

			var listChoice = null;
			var func = null;

			if (title == Translate["#status#"]) {
				var query = new Query("SELECT Id, Description FROM Enum_OutletStatus");
				listChoice = query.Execute();
				var table = [];
				while (listChoice.Next()) {
					table.push([listChoice["Id"], Translate[String.Format("#{0}#", listChoice.Description)]]);
				}
				listChoice = table;
			}

			if (title == Translate["#partner#"]){
				var query = new Query("SELECT DISTINCT D.Id, D.Description " +
					" FROM Catalog_Distributor D " +
					" JOIN Catalog_Territory_Distributors TD ON D.Id=TD.Distributor " +
					" JOIN Catalog_Territory_Outlets T ON TD.Ref=T.Ref AND T.Outlet=@outlet " +
					" UNION SELECT @emptyRef, '-'" +
					" ORDER BY Description ");
				query.AddParameter("outlet", outlet);
				query.AddParameter("emptyRef", DB.EmptyRef("Catalog.Distributor"));
				listChoice = query.Execute();
			}

			Dialogs.DoChoose(listChoice, outlet, attribute, control, func, title);
		}
	}
}

function GetDescr(description){

	return String.IsNullOrEmpty(description) ? "—" : description;
}


function DistrCallBack(state, args){
	AssignDialogValue(state, args);
	var control = state[2];
	if (args.Result==DB.EmptyRef("Catalog.Distributor"))
		control.Text = "—";
	else
		control.Text = args.Result.Description;
}

//--------------------------editing additional parameters handlers-----------------------------

function CreateOutletParameterValue(outlet, parameter, value, parameterValue, isEditText) {
	var q = new Query("SELECT Id FROM Catalog_Outlet_Parameters WHERE Ref=@ref AND Parameter = @parameter");
	q.AddParameter("ref", outlet);
	q.AddParameter("parameter", parameter);
	parameterValue = q.ExecuteScalar();
	if (parameterValue == null) {
		parameterValue = DB.Create("Catalog.Outlet_Parameters");
		parameterValue.Ref = outlet;
		parameterValue.Parameter = parameter;
		parameterValue.Save();
	} else{
		parameterValue = parameterValue.GetObject();
		if (isEditText){
			if ((parameter.DataType).ToString() != (DB.Current.Constant.DataType.Snapshot).ToString())
			parameterValue.Value = value;
			parameterValue.Save();
		}
	}
	return parameterValue.Id;
}

function AssignParameterValue(control, typeDescription, parameterValue, value, outlet, parameter){
	CreateOutletParameterValue(outlet, parameter, control.Text, parameterValue, true)
}

function GoToParameterAction(typeDescription, parameterValue, value, outlet, parameter, control, parameterDescription, editable, index, isEditText) {

	if (editable) {

		if ($.sessionConst.editOutletParameters) {
			parameterValue = CreateOutletParameterValue(outlet, parameter, parameterValue, parameterValue, isEditText);

			if (typeDescription == "ValueList") {  //--------ValueList-------
				var q = new Query();
				q.Text = "SELECT Value, Value FROM Catalog_OutletParameter_ValueList WHERE Ref=@ref UNION SELECT '', '—' ORDER BY Value";
				q.AddParameter("ref", parameter);
				Dialogs.DoChoose(q.Execute(), parameterValue, "Value", Variables[control], null, parameterDescription);
			}
			if (typeDescription == "DateTime") {  //---------DateTime-------
				if (String.IsNullOrEmpty(parameterValue.Value))
					Dialogs.ChooseDateTime(parameterValue, "Value", Variables[control], DateHandler, parameterDescription);
				else
					Dialog.Choose(parameterDescription, [[0, Translate["#clearValue#"]], [1, Translate["#setDate#"]]], DateHandler, [parameterValue, control, parameterDescription]);
			}
			if (typeDescription == "Boolean") {  //----------Boolean--------
				Dialogs.ChooseBool(parameterValue, "Value", Variables[control], null, parameterDescription);
			}
			if (typeDescription == "Snapshot") { //----------Snapshot-------
				query = new Query("SELECT Value FROM Catalog_Outlet_Parameters WHERE Parameter = @parameter AND Ref = @outlet")
				query.AddParameter("parameter", parameter);
				query.AddParameter("outlet", outlet);
				var snapshotId = query.ExecuteScalar();
				var snapshotIdIsEmpty = snapshotId == null || String.IsNullOrWhiteSpace(snapshotId);
				var source = (!snapshotIdIsEmpty ? Variables[("parameterImage"+index)].Source : null);
				Images.AddSnapshot(outlet, parameterValue, SaveAtOutelt, parameterDescription, source);
				parameterValueC = parameterValue;
			}
			if (typeDescription == "String" || typeDescription == "Integer" || typeDescription == "Decimal") {
				FocusOnEditText(control, '1');
			}
		}
	}
	if ($.Exists("parameterImage"+index)){
		if (typeDescription == "Snapshot" && (parseInt(editable)==parseInt(0) || !$.sessionConst.editOutletParameters)){
			Workflow.Action("ShowImage", [Variables[("parameterImage"+index)].Source, parameter, "Value", true])
		}
	}
}

function GetStatusDescription(outlet) {
	var query = new Query("SELECT Description FROM Enum_OutletStatus WHERE Id = @status");
	query.AddParameter("status", outlet.OutletStatus);
	queryResult = query.ExecuteScalar();
	result = Translate[String.Format("#{0}#", queryResult)]
	return result;
}

function FocusIfHasEditText(fieldName, editOutletParameters, primaryParameterName) {
	if (editOutletParameters && $.primaryParametersSettings[primaryParameterName]) {
		FocusOnEditText(fieldName, 1);
	}
}

function DateHandler(state, args) {
	var parameterValue = state[0];
	var control = state[1];
	if(getType(args.Result)=="System.DateTime"){
		parameterValue = parameterValue.GetObject();
		parameterValue.Value = Format("{0:dd.MM.yyyy HH:mm}", Date(args.Result));
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
		var parameterDescription = state[2];
		Dialogs.ChooseDateTime(parameterValue, "Value", Variables[control], DateHandler, parameterDescription);
	}
}

function GetSnapshots(outlet) {

	var q = new Query("SELECT S.Id AS Id, " +
										"CASE WHEN TRIM(IFNULL(OFILES.FullFileName, '')) != '' THEN LOWER(OFILES.FullFileName) ELSE '/shared/result.jpg' END AS FullFileName, " +
										"S.FileName AS FileName, " +
										"S.LineNumber AS LineNumber " +
										"FROM Catalog_Outlet_Snapshots S " +
										"LEFT JOIN Catalog_Outlet_Files OFILES ON S.FileName = OFILES.FileName AND OFILES.Ref = @ref " +
										"WHERE S.Ref=@ref AND (S.Deleted!='1' OR S.Deleted IS NULL) ORDER BY S.LineNumber");

	q.AddParameter("ref", outlet);

	snapshotsExists = true;

	countOfFiles = q.ExecuteCount();

	if (parseInt(countOfFiles)==parseInt(0)) {

		snapshotsExists = false;

	}

	singlePicture = false;

	if (parseInt(countOfFiles)==parseInt(1)) {

		singlePicture = true;

	}

	return q.Execute();

}

function NoSnapshots() {
	if (snapshotsExists)
		return false;
	else
		return true;
}

function GetImagePath(objectID, pictID, pictExt) {
	return Images.FindImage(objectID, pictID, pictExt, "Catalog_Outlet_Files");
}

function ImageActions(control, valueRef, imageControl, outlet, filename) {
	if ($.sessionConst.editOutletParameters && $.primaryParametersSettings["000000008"]) {
		parameterValueC = valueRef;
		Images.AddSnapshot($.outlet, valueRef, OutletSnapshotHandler, Translate["#snapshot#"], Variables[imageControl].Source);
	} else {
		Workflow.Action("ShowImage", [GetImagePath(outlet, filename, ".jpg"), valueRef, "Value", true])
	}

}

function AddSnapshot(control, outlet) {
		parameterValueC = null;
		Images.AddSnapshot(outlet, null, OutletSnapshotHandler, Translate["#outletSnapshots#"], null);
}

function OutletSnapshotHandler(state, args) {
	if (args.Result){
		var outlet = state[0];
		var fileName = state[1];
		var fullFileName = state[2];
		var newPicture;

		if (String.IsNullOrEmpty(parameterValueC))
			newPicture = DB.Create("Catalog.Outlet_Snapshots");
		else
			newPicture = parameterValueC.GetObject();
		newPicture.Ref = outlet;
		newPicture.FileName = fileName;
		newPicture.Save();

		newFile = DB.Create("Catalog.Outlet_Files");
		newFile.Ref = outlet;
		newFile.FileName = fileName;
		newFile.FullFileName = fullFileName;
		newFile.Save();

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
		if (ActualLocation(location)) {
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
	if (ActualLocation(location)) {
		outlet = outlet.GetObject();
		outlet.Lattitude = location.Latitude;
		outlet.Longitude = location.Longitude;
		outlet.Save();
		Workflow.Refresh([]);
	} else
		NoLocationHandler(SetLocation, outlet);
}

function CoordsChecked(visit) {

	var location = GPS.CurrentLocation;
	if (ActualLocation(location)) {
		var visitObj = visit.GetObject();
		visitObj.Lattitude = location.Latitude;
		visitObj.Longitude = location.Longitude;
		visitObj.Save();
	}
	
	if (Variables["workflow"]["name"] == "Visit" && NotEmptyRef(visit.Plan)) {
		var query = new Query("SELECT LogicValue FROM Catalog_MobileApplicationSettings WHERE Description='CoordinateControlEnabled'");
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
		if (ActualLocation(location)) {
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

function ShowCoordOptions(control, outlet, editOutletParameters) {
	if (editOutletParameters && $.primaryParametersSettings["000000003"]) {
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

//---------------------------------Contractors--------------------------

function ShowContractorsIfExists(outlet) {

	var con = parseInt(HasContractors(outlet));

	if (con == parseInt(0))
		Dialog.Message(Translate["#noContractors#"]);

	else if (con == parseInt(1))
	{
		var outletObj = outlet.LoadObject();

		var contractor;
		if (outletObj.Distributor==DB.EmptyRef("Catalog_Distributor"))
		{
			var q = new Query("SELECT Contractor FROM Catalog_Outlet_Contractors WHERE Ref=@ref");
			q.AddParameter("ref", outlet);
			contractor = q.ExecuteScalar();
		}
		else
		{
			var q = new Query("SELECT Contractor FROM Catalog_Distributor_Contractors WHERE Ref=@ref");
			q.AddParameter("ref", outletObj.Distributor);
			contractor = q.ExecuteScalar();
		}
		DoAction('Contractor', contractor);
	}

	else if (con > parseInt(1))
		DoAction('ShowContractors');
}

function HasContractors(outlet){

	var res;

	var outletObj = outlet.GetObject();
	if (outletObj.Distributor==DB.EmptyRef("Catalog_Distributor"))
		res = HasOutletContractors(outlet);
	else
		res = HasPartnerContractors(outlet);

	return res;
}

function HasOutletContractors(outlet) {
	var q = new Query("SELECT COUNT(Id) FROM Catalog_Outlet_Contractors WHERE ref = @outlet")
	q.AddParameter("outlet", outlet);
	return q.ExecuteScalar();
}

function HasPartnerContractors(outlet){
	var outletObj = outlet.GetObject();
	var q = new Query("SELECT COUNT(Id) FROM Catalog_Distributor_Contractors C WHERE C.Ref=@distr");
	q.AddParameter("distr", outletObj.Distributor);
	return q.ExecuteScalar();
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
		Workflow.Commit();
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

		newFile = DB.Create("Catalog.Outlet_Files");
		newFile.Ref = arr[0];
		newFile.FileName = arr[1];
		newFile.FullFileName = arr[2];
		newFile.Save();

		Workflow.Refresh([]);
	}
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

function BackMenu(){
	if (GlobalWorkflow.GetMenuItem() == "Outlets")
		return false;
	else
		return true;
}

function CommitAndBack(){
	DB.Commit();
	Workflow.Rollback();
}

function SnapshotExists(filename) {

	return FileSystem.Exists(filename);

}

function GetNextVisit(outlet){
	var q = new Query("SELECT strftime('%d.%m.%Y',VP.Date) AS PlanDate " +
			"FROM Document_VisitPlan_Outlets VP " +
			"LEFT JOIN Document_Visit V ON V.Plan = VP.Ref AND V.Outlet = VP.Outlet AND date(V.Date) = date(VP.Date) AND date(V.Date) >= date('now') " +
			"WHERE VP.Outlet=@outlet AND date(VP.Date) >= date('now') AND V.Id Is Null LIMIT 1");
	q.AddParameter("outlet", outlet);
	q.AddParameter("date", DateTime.Now);
	var res = q.ExecuteScalar();
	if (res != null)
		return res;
	else
		return null;
}
