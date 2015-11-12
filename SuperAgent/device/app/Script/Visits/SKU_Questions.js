var regularAnswers;
var parentId;
var parentGUID;
var obligateredLeft;
var regular_answ;
var regular_total;
var single_answ;
var single_total;
var scrollIndex;
var setScroll;
var bool_answer;
var curr_item;
var curr_sku;
var skuValueGl;
var questionValueGl;
var forwardAllowed;


//
//-------------------------------Header handlers-------------------------
//

function OnLoading(){
	obligateredLeft = '0';
	SetIndicators();
	SetListType();
	if (String.IsNullOrEmpty(setScroll))
		setScroll = true;
	if ($.param2==true) //works only in case of Forward from Filters
		ClearIndex();
	forwardAllowed = true;

}

function OnLoad() {
	if (setScroll)
		SetScrollIndex();
}

function SetListType(){
	if (regularAnswers==null)
	{
		if (parseInt(regular_total) == parseInt(0))
			regularAnswers = false;
		else
			regularAnswers = true;
	}
}

function ChangeListAndRefresh(control, param) {
	regularAnswers	= ConvertToBoolean1(param);
	parentId = null;
	parentGUID = null;
	Workflow.Refresh([]);
}

function SetScrollIndex() {

	if (String.IsNullOrEmpty(scrollIndex)){
		$.grScrollView.Index = parseInt(4);
	}
	else{
		var s = (parseInt(scrollIndex) * parseInt(2)) + parseInt(6);
		$.grScrollView.Index = s;
	}
}

function CountResultAndForward() {

	parentId = null;

	var q = regular_total + single_total;
	$.workflow.Add("questions_qty_sku", q);

	var a = regular_answ + single_answ;
	$.workflow.Add("questions_answ_sku", a);

	Workflow.Forward([]);
}

//
//--------------------------------Questions list handlers--------------------------
//

function HasQuestions(){
	if (regularAnswers && parseInt(regular_total)==parseInt(0))
		return false;
	if (!regularAnswers && parseInt(single_total)==parseInt(0))
		return false;
	return true;
}

function GetSKUsFromQuesionnaires(search) {

	var single = 1;
	if (regularAnswers)
		single = 0;

	// SetIndicators();

	//getting left obligated
	var q = new Query("SELECT DISTINCT S.Question, S.Description, S.SKU " +
			"FROM USR_SKUQuestions S " +
			"WHERE (RTRIM(Answer)='' OR S.Answer IS NULL) AND S.Obligatoriness=1 " +
			"AND (S.ParentQuestion=@emptyRef OR S.ParentQuestion IN (SELECT SS.Question FROM USR_SKUQuestions SS " +
				"WHERE SS.SKU=S.SKU AND (SS.Answer='Yes' OR SS.Answer='Да')))");
	q.AddParameter("emptyRef", DB.EmptyRef("Catalog_Question"));
	obligateredLeft = q.ExecuteCount().ToString();
	forwardAllowed = obligateredLeft == '0';

	//getting SKUs list
	var searchString = "";
	if (String.IsNullOrEmpty(search) == false) {
		search = StrReplace(search, "'", "''");
		searchString = " Contains(SKUDescription, '" + search + "') AND ";
	}

	var filterString = "";

	filterString += AddFilter(filterString, "group_filter", "OwnerGroup", " AND ");
	filterString += AddFilter(filterString, "brand_filter", "Brand", " AND ");

	var q = new Query();
	q.Text="SELECT S.SKU, S.SKUDescription " +
			", COUNT(DISTINCT S.Question) AS Total " +
			", COUNT(DISTINCT S.Answer) AS Answered " +
			", MAX(CAST (Obligatoriness AS INT)) AS Obligatoriness " +
			", (SELECT COUNT(DISTINCT U1.Question) FROM USR_SKUQuestions U1 " +
				" WHERE U1.Single=@single AND (Answer='' OR Answer IS NULL) " +
				" AND U1.SKU=S.SKU AND Obligatoriness = 1 " +
				" AND (ParentQuestion=@emptyRef OR ParentQuestion IN (SELECT Question FROM USR_SKUQuestions " +
				" WHERE SKU=S.SKU AND (Answer='Yes' OR Answer='Да')))) AS ObligateredLeft " +
			", (SELECT MAX(AMS.BaseUnitQty) FROM Catalog_AssortmentMatrix_SKUs AMS " +
				" JOIN Catalog_AssortmentMatrix_Outlets AMO ON AMS.Ref = AMO.Ref AND AMO.Outlet = @outlet " +
				" WHERE S.SKU=AMS.SKU) AS BaseUnitQty " +
			", CASE WHEN S.SKU=@currentSKU THEN 1 ELSE 0 END AS ShowChild " +

			"FROM USR_SKUQuestions S " +

			"WHERE S.Single=@single AND " + searchString + filterString +
			" (S.ParentQuestion=@emptyRef OR S.ParentQuestion IN (SELECT Question FROM USR_SKUQuestions SS " +
				"WHERE SS.SKU=S.SKU AND (SS.Answer='Yes' OR SS.Answer='Да')))" +
			"GROUP BY S.SKU, S.SKUDescription " +
			" ORDER BY BaseUnitQty DESC, S.SKUDescription ";
	q.AddParameter("emptyRef", DB.EmptyRef("Catalog_Question"));
	q.AddParameter("single", single);
	q.AddParameter("snapshot", DB.Current.Constant.DataType.Snapshot);
	q.AddParameter("attached", Translate["#snapshotAttached#"]);
	q.AddParameter("outlet", $.workflow.outlet);
	q.AddParameter("currentSKU", parentGUID);

	return q.Execute();
	//
}

function SetIndicators() {
	var q = new Query("SELECT " +
		"SUM(CASE WHEN Single = 0 THEN 1 ELSE 0 END) AS RegularTotal, " +
		"SUM(CASE WHEN Single = 1 THEN 1 ELSE 0 END) AS SingleTotal, " +
		"SUM(CASE WHEN Single = 0 AND TRIM(IFNULL(Answer, '')) != '' THEN 1 ELSE 0 END) AS RegularAnsw, " +
		"SUM(CASE WHEN Single = 1 AND TRIM(IFNULL(Answer, '')) != '' THEN 1 ELSE 0 END) AS SingleAnsw " +

		"FROM (SELECT DISTINCT Question, SKU, Single, Answer " +
			"FROM USR_SKUQuestions U1 " +
			"WHERE ParentQuestion=@emptyRef OR ParentQuestion IN " +
				"(SELECT Question FROM USR_SKUQuestions U2 WHERE (Answer='Yes' OR Answer='Да') AND U1.SKU=U2.SKU))");

	q.AddParameter("emptyRef", DB.EmptyRef("Catalog_Question"));
	var result = q.Execute();

	regular_total = result.RegularTotal;
	single_total = result.SingleTotal;
	regular_answ = result.RegularAnsw;
	single_answ = result.SingleAnsw;
}

function AddFilter(filterString, filterName, condition, connector) {

	var q = new Query("SELECT F.Id FROM USR_Filters F WHERE F.FilterType = @filterName");

	q.AddParameter("filterName", filterName);

	var res = q.ExecuteScalar();

	if (res!=null) {

		filterString += condition + " IN(SELECT F.Id FROM USR_Filters F WHERE F.FilterType = '" + filterName + "') " + connector;

	}

	return filterString;

}

function ShowChilds(index) {
	var s = "p" + index;
	if (s == parentId)
		return true;
	else
		return false;
}

function GetChilds(sku) {

	var single = 1;
	if (regularAnswers)
		single = 0;

var q = new Query("SELECT S.Description, S.Obligatoriness, S.AnswerType, S.Question, S.Answer, S.IsInputField, S.KeyboardType, " +
			"CASE WHEN IsInputField='1' THEN Answer ELSE " +
				"CASE WHEN (RTRIM(Answer)!='' AND Answer IS NOT NULL) THEN CASE WHEN AnswerType=@snapshot THEN @attached ELSE Answer END ELSE '—' END END AS AnswerOutput, " +
				"CASE WHEN S.AnswerType=@snapshot THEN 1 END AS IsSnapshot, " +
			"CASE WHEN S.AnswerType=@snapshot THEN " +
				" CASE WHEN TRIM(IFNULL(VFILES.FullFileName, '')) != '' THEN LOWER(VFILES.FullFileName) ELSE " +
					" CASE WHEN TRIM(IFNULL(OFILES.FullFileName, '')) != '' THEN LOWER(OFILES.FullFileName) ELSE '/shared/result.jpg' END END ELSE NULL END AS FullFileName " +
			"FROM USR_SKUQuestions S " +
			"LEFT JOIN Document_Visit_Files VFILES ON VFILES.FileName = S.Answer AND VFILES.Ref = @visit " +
			"LEFT JOIN Catalog_Outlet_Files OFILES ON OFILES.FileName = S.Answer AND OFILES.Ref = @outlet " +
			"WHERE S.SKU=@sku AND S.Single=@single AND (S.ParentQuestion=@emptyRef OR S.ParentQuestion IN (SELECT Question FROM USR_SKUQuestions " +
			"WHERE SKU=S.SKU AND (Answer='Yes' OR Answer='Да'))) " +
			"ORDER BY S.DocDate, S.QuestionOrder ");
	q.AddParameter("sku", sku);
	q.AddParameter("emptyRef", DB.EmptyRef("Catalog_Question"));
	q.AddParameter("single", single);
	q.AddParameter("snapshot", DB.Current.Constant.DataType.Snapshot);
	q.AddParameter("attached", Translate["#snapshotAttached#"]);
	q.AddParameter("visit", $.workflow.visit);
	q.AddParameter("outlet", $.workflow.outlet);
	result = q.Execute();
	return result;
}

function GetImagePath(visitID, outletID, pictID, pictExt) {
	var pathFromVisit = Images.FindImage(visitID, pictID, pictExt, "Document_Visit_Files");
	var pathFromOutlet = Images.FindImage(outletID, pictID, pictExt, "Catalog_Outlet_Files");
	return (pathFromVisit == "/shared/result.jpg" ? pathFromOutlet : pathFromVisit);
}

function RefreshScreen(control, search, sku, question, answerType) {

	var answer = control.Text;

	if (!String.IsNullOrEmpty(answer) && answerType == DB.Current.Constant.DataType.Integer){

		control.Text = RoundToInt(answer);

		AssignAnswer(control, question, sku, answer, answerType);
	}

	Workflow.Refresh([search]);
}

function SnapshotExists(filename) {
	return FileSystem.Exists(filename);
}
// ------------------------SKU----------------------

function CreateItemAndShow(control, sku, index, showChild) {
//	if (parentId == ("p"+index)){
//		parentId = null;
//		scrollIndex = null;
//	}
//	else
//		parentId = "p" + index;

	if (showChild){
		parentGUID = null;
		scrollIndex = null;
	}
	else
		parentGUID = sku;

	scrollIndex = index;
	setScroll = true;

	Workflow.Refresh([$.search]);
}

function GoToQuestionAction(control, answerType, question, sku, editControl, currAnswer, title) {

	editControlName = editControl;
	editControl = Variables[editControl];
	curr_sku = sku;

	if ((answerType).ToString() == (DB.Current.Constant.DataType.ValueList).ToString()) {
		var q = new Query();
		q.Text = "SELECT Value, Value FROM Catalog_Question_ValueList WHERE Ref=@ref UNION SELECT '', '—' ORDER BY Value";
		q.AddParameter("ref", question);
		//Dialogs.DoChoose(q.Execute(), question, null, editControl, DialogCallBack);
		DoChoose(q.Execute(), question, null, editControl, DialogCallBack, title);
	}

	if ((answerType).ToString() == (DB.Current.Constant.DataType.Snapshot).ToString()) {
		skuValueGl = sku;
		questionValueGl = question;

		//AddSnapshot($.workflow.visit, null, GalleryCallBack, listChoice, "document.visit", title);
		var path = null;
//		if (String.IsNullOrEmpty(currAnswer)==false)
//			path = Images.FindImage($.visit, currAnswer, ".jpg");
		Images.AddQuestionSnapshot("USR_SKUQuestions", question, sku, currAnswer, true, title, GalleryCallBack);
	}

	if ((answerType).ToString() == (DB.Current.Constant.DataType.DateTime).ToString()) {
		//Dialogs.ChooseDateTime(question, null, editControl, DialogCallBack);
		ChooseDateTime(question, null, editControl, DialogCallBack, title);
	}

	if ((answerType).ToString() == (DB.Current.Constant.DataType.Boolean).ToString()) {
		bool_answer = currAnswer;
		curr_item = sku;
		//Dialogs.ChooseBool(question, null, editControl, DialogCallBack);
		ChooseBool(question, null, editControl, DialogCallBack, title);
	}

	if (((answerType).ToString() == (DB.Current.Constant.DataType.String).ToString()) ||
	   ((answerType).ToString() == (DB.Current.Constant.DataType.Integer).ToString()) ||
		 ((answerType).ToString() == (DB.Current.Constant.DataType.Decimal).ToString())) {
		FocusOnEditText(editControlName, '1');
	}

	setScroll = false;
}

function AssignAnswer(control, question, sku, answer, answerType) {

	if (control != null) {
		answer = control.Text;
	} else{
		if (answer!=null)
			answer = answer.ToString();
	}
	if (answer == "—" || answer == "" || answer=="-")
		answer = null;

	var answerString;
	if (String.IsNullOrEmpty(answer))
		answerString = "HistoryAnswer ";
	else
		answerString = "@answer ";

	var q =	new Query("UPDATE USR_SKUQuestions SET Answer=" + answerString + ", AnswerDate=DATETIME('now', 'localtime') WHERE Question=@question AND SKU=@sku");
	q.AddParameter("answer", (question.AnswerType == DB.Current.Constant.DataType.DateTime ? Format("{0:dd.MM.yyyy HH:mm}", Date(answer)) : answer));
	q.AddParameter("sku", sku);
	q.AddParameter("question", question);
	q.Execute();
}

function GetCameraObject(entity) {
	FileSystem.CreateDirectory("/private/document.visit");
	//var guid = Global.GenerateGuid();
	var guid = GenerateGuid();
	//Variables.Add("guid", guid);
	var path = String.Format("/private/document.visit/{0}/{1}.jpg", entity.Id, guid);
	Camera.Size = 300;
	Camera.Path = path;
	return guid;
}

function ObligatedAnswered(answer, obligatoriness) {
	if (parseInt(obligatoriness)==parseInt(1)){
		if (String.IsNullOrEmpty(answer)==false & answer!="—")
			return true;
	}
	return false;
}

function GetActionAndBack() {
	var q = new Query("SELECT NextStep " +
		" FROM USR_WorkflowSteps" +
		" WHERE Value=0 AND StepOrder<'3' ORDER BY StepOrder DESC");
	var step = q.ExecuteScalar();
	if (step==null)
		Workflow.BackTo("Outlet");
	else
		Workflow.BackTo(step);
}

function DoSearch(searcText) {
	ClearIndex();
	Workflow.Refresh([searcText]);
}

function ClearIndex() {
	parentId =null;
	scrollIndex = null;
	setScroll = null;
}

//------------------------------internal-----------------------------------

function DialogCallBack(state, args){
	var entity = state[0];
	AssignAnswer(null, entity, curr_sku, args.Result);

	Workflow.Refresh([$.search]);
}

function GalleryCallBack(state, args) {
	if (args.Result) {
		AssignAnswer(null, questionValueGl, skuValueGl, state[1]);

		newFile = DB.Create("Document.Visit_Files");
		newFile.Ref = state[0];
		newFile.FileName = state[1];
		newFile.FullFileName = state[2];
		newFile.Save();

		Workflow.Refresh([]);
	}
}

function DeleteAnswers(recordset) {
	while (recordset.Next()){
		DB.Delete(recordset.Id);
	}
}

//-------------------------------Gallery handler-----------------------------------

function AddSnapshot(objectRef, valueRef, func, listChoice, objectType, title) {
	title = typeof title !== 'undefined' ? title : "#select_answer#";
	Dialog.Choose(title, listChoice, AddSnapshotHandler, [objectRef,func,valueRef,objectType]);
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
		AssignAnswer(null, questionValueGl, skuValueGl, null);
		Workflow.Refresh([]);
	}
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

	var listChoice = [[ "—", "-" ], [Translate["#YES#"], Translate["#YES#"]], [Translate["#NO#"], Translate["#NO#"]]];
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
