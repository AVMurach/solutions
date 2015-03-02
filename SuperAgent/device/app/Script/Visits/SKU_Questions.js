﻿var skuOnScreen;
var regularAnswers;
var parentId;
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
var doRefresh;

//
//-------------------------------Header handlers-------------------------
//


function OnLoading(){
	doRefresh = false;
	skuOnScreen = null;
	obligateredLeft = parseInt(0);	
	SetListType();
	if (String.IsNullOrEmpty(setScroll))
		setScroll = true;
	if ($.param2==true) //works only in case of Forward from Filters 
		ClearIndex();
}

function OnLoad() {
	if (setScroll)
		SetScrollIndex();
}

function SetListType(){
	if (regularAnswers==null)
		regularAnswers = true;
}

function ChangeListAndRefresh(control, param) {
	regularAnswers	= ConvertToBoolean1(param);	
	parentId = null;
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

//
//--------------------------------Questions list handlers--------------------------
//


function GetSKUsFromQuesionnaires(search) {
	
	var single = 1;
	if (regularAnswers)	
		single = 0;
	
	SetIndicators();
	

	
	obligateredLeft = 0;
	
	var searchString = "";
	if (String.IsNullOrEmpty(search) == false)
		searchString = " Contains(SKUDescription, '" + search + "') AND ";
	
	var filterString = "";
	var filterJoin = "";
	filterString += AddFilter(filterString, "group_filter", "OwnerGroup", " AND ");
	filterString += AddFilter(filterString, "brand_filter", "Brand", " AND ");
	
	var q = new Query();
	q.Text="SELECT DISTINCT SKU, SKUDescription " +
			", (SELECT COUNT(DISTINCT U1.Question) FROM USR_SKUQuestions U1 WHERE U1.Single=@single " +
				" AND U1.SKU=S.SKU AND " +
				" (ParentQuestion=@emptyRef OR ParentQuestion IN (SELECT Question FROM USR_SKUQuestions " +
				" WHERE SKU=S.SKU AND (Answer='Yes' OR Answer='Да')))) AS Total " +
			", (SELECT COUNT(DISTINCT U1.Question) FROM USR_SKUQuestions U1 WHERE U1.Single=@single " +
				" AND U1.SKU=S.SKU " +
				" AND (Answer!='' OR Answer IS NOT NULL) " +
				" AND (ParentQuestion=@emptyRef OR ParentQuestion IN (SELECT Question FROM USR_SKUQuestions " +
				" WHERE SKU=S.SKU AND Question=S.Question AND (Answer='Yes' OR Answer='Да')))) AS Answered " +
			", (SELECT COUNT(DISTINCT Question) FROM USR_SKUQuestions " +
				" WHERE Single=@single AND Obligatoriness='1' AND SKU=S.SKU AND " +
				" (ParentQuestion=@emptyRef OR ParentQuestion IN (SELECT Question FROM USR_SKUQuestions " +
				" WHERE SKU=S.SKU AND (Answer='Yes' OR Answer='Да')))) AS Obligatered " +
			", CASE WHEN IsInputField='1' THEN Answer ELSE " +
			"CASE WHEN (RTRIM(Answer)!='' AND Answer IS NOT NULL) THEN CASE WHEN AnswerType=@snapshot THEN @attached ELSE Answer END ELSE '—' END END AS AnswerOutput " +
			"FROM USR_SKUQuestions S " + filterJoin +
			"WHERE Single=@single AND " + searchString + filterString + 
			" (ParentQuestion=@emptyRef OR ParentQuestion IN (SELECT Question FROM USR_SKUQuestions " +
				"WHERE (Answer='Yes' OR Answer='Да')))" +
			"ORDER BY SKUDescription "; 
	q.AddParameter("emptyRef", DB.EmptyRef("Catalog_Question"));
	q.AddParameter("single", single);	
	q.AddParameter("snapshot", DB.Current.Constant.DataType.Snapshot);
	q.AddParameter("attached", Translate["#snapshotAttached#"]);	
	
	return q.Execute();
}

function ObligateredAreAnswered(obligatoriness, history, current, oblTotal) {
	if (parseInt(obligatoriness)==parseInt(0))
		return false;
	else{
		if (parseInt(obligatoriness)==parseInt(1) || (parseInt(oblTotal)==(parseInt(history)+parseInt(current))))
			return true;
		else
			return false;
	}
}

function SetIndicators() {
	regular_total = 0;//CalculateTotal(str, '0', false);
	single_total = 0;//CalculateTotal(str, '1', false);		
	regular_answ = 0;//CalculateTotal(str, '0', true);
	single_answ = 0;//CalculateTotal(str, '1', true);
}

function CalculateTotal(str, single, answer) {
	var join="";
	var cond = "";
	if (answer){
		join = " JOIN Document_Visit_SKUs V ON S.SKU=V.SKU AND Q.ChildQuestion=V.Question AND RTRIM(V.Answer)!='' AND V.Answer IS NOT NULL ";
		cond = " AND V.Ref=@visit ";			
	}
	
	var q = new Query("SELECT DISTINCT S.SKU, Q.ChildQuestion " +
	" FROM Document_Questionnaire D" +
	" JOIN Document_Questionnaire_SKUs S ON D.Id=S.Ref" +
	" JOIN Document_Questionnaire_SKUQuestions Q ON D.Id=Q.Ref" +
	join +
	" WHERE " + str + " D.Single = @single " +
	" AND (Q.ParentQuestion=@emptyRef OR Q.ParentQuestion IN " +
		"(SELECT Question FROM Document_Visit_SKUs WHERE (Answer='Yes' OR Answer='Да') AND SKU=S.SKU AND Ref=@visit) " +
		" OR (ParentQuestion IN (SELECT Question FROM Catalog_Outlet_AnsweredQuestions " +
		" WHERE (Answer='Yes' OR Answer='Да') AND Ref=@outlet AND Questionaire=D.Id AND SKU=S.SKU) AND Q.ParentQuestion NOT IN " +
		" (SELECT Question FROM Document_Visit_SKUs WHERE (Answer='No' OR Answer='Нет') AND SKU=S.SKU AND Ref=@visit)))" + cond);	
	q.AddParameter("emptyRef", DB.EmptyRef("Catalog_Question"));
	q.AddParameter("visit", $.workflow.visit);
	q.AddParameter("single", single);
	q.AddParameter("outlet", $.workflow.outlet);
	q.AddParameter("emptySKU", DB.EmptyRef("Catalog_SKU"));
	if (answer && single=='1'){
		var strAnswered = CreateCondition($.workflow.questionnaires, " A.Questionaire ");
		var histQuery = new Query("SELECT DISTINCT A.Question, A.SKU " +
				" FROM Catalog_Outlet_AnsweredQuestions A " +
				" JOIN Document_Questionnaire_Schedule SCc " +
				" JOIN Document_Questionnaire_SKUQuestions Q " +
				" LEFT JOIN Document_Visit_SKUs V ON V.Ref=@visit AND V.Question=A.Question AND V.SKU=A.SKU " +
				" WHERE V.Ref IS NULL AND A.Ref=@outlet AND A.SKU!=@emptySKU AND " + strAnswered + " DATE(A.AnswerDate)>=DATE(SCc.BeginAnswerPeriod) " +
				" AND (DATE(A.AnswerDate)<=DATE(SCc.EndAnswerPeriod) OR A.AnswerDate='0001-01-01 00:00:00') " +
				" AND (Q.ParentQuestion=@emptyRef OR Q.ParentQuestion IN (SELECT Question FROM Catalog_Outlet_AnsweredQuestions " +
				" WHERE (Answer='Yes' OR Answer='Да') AND Ref=A.Ref AND Questionaire=A.Questionaire AND SKU=A.SKU)) ");
				histQuery.AddParameter("emptyRef", DB.EmptyRef("Catalog_Question"));
				histQuery.AddParameter("outlet", $.workflow.outlet);
				histQuery.AddParameter("visit", $.workflow.visit);
				histQuery.AddParameter("emptySKU", DB.EmptyRef("Catalog_SKU"));
		return (histQuery.ExecuteCount() + q.ExecuteCount()); 
	}
	else
		return q.ExecuteCount();
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

function ForwardIsntAllowed() {
	if (parseInt(obligateredLeft)!=parseInt(0))
		return true;
	else
		return false;
}

function ShowChilds(index) {	
	var s = "p" + index; 
	if (s == parentId)
		return true;
	else
		return false;
}

function GetChilds(sku) {
	var str = CreateCondition($.workflow.questionnaires, " D.Id ");
	
	var single = 1;
	if (regularAnswers)	
		single = 0;
	
	var q = new Query();
	q.Text = "SELECT MIN(D.Date) AS DocDate, Q.ChildQuestion AS Id, Q.ChildDescription AS Description " +
			", Q.ChildType AS AnswerType, MAX(CAST(Q.Obligatoriness AS int)) AS Obligatoriness " +
			", (SELECT Qq.QuestionOrder FROM Document_Questionnaire Dd  " +
			" JOIN Document_Questionnaire_SKUQuestions Qq ON Dd.Id=Qq.Ref AND Q.ChildQuestion=Qq.ChildQuestion WHERE D.Id=Dd.Id ORDER BY Dd.Date LIMIT 1) AS QuestionOrder" +
			", CASE WHEN (RTRIM(V.Answer)='' OR V.Answer IS NULL) THEN " +
				" CASE WHEN A.Answer IS NOT NULL THEN " +
					" CASE WHEN Q.ChildType=@snapshot THEN @attached ELSE A.Answer END " +
				" ELSE " +
					" CASE WHEN Q.ChildType!=@integer AND Q.ChildType!=@decimal AND Q.ChildType!=@string THEN '—' END " +
				" END " +
			" ELSE CASE WHEN Q.ChildType=@snapshot THEN @attached ELSE V.Answer END END AS Answer " +
			", CASE WHEN Q.ChildType=@integer OR Q.ChildType=@decimal OR Q.ChildType=@string THEN 1 ELSE NULL END AS IsInputField " +
			", CASE WHEN Q.ChildType=@integer OR Q.ChildType=@decimal THEN 'numeric' ELSE 'auto' END AS KeyboardType " + 
			
			" FROM Document_Questionnaire D " +
			" JOIN Document_Questionnaire_SKUQuestions Q ON D.Id=Q.Ref " +
			" JOIN Document_Questionnaire_SKUs S ON D.Id=S.Ref AND S.SKU=@sku " +
			" JOIN Document_Questionnaire_Schedule SC ON SC.Ref=D.Id AND date(SC.Date)=date('now','start of day') " +
			" LEFT JOIN Document_Visit_SKUs V ON V.Question=Q.ChildQuestion AND V.Ref=@visit AND V.SKU=S.SKU " + 
			" LEFT JOIN Catalog_Outlet_AnsweredQuestions A ON A.Ref = @outlet AND A.Questionaire=D.Id " +
			" AND A.Question=Q.ChildQuestion AND A.SKU=S.SKU AND DATE(A.AnswerDate)>=DATE(SC.BeginAnswerPeriod) " +
			" AND (DATE(A.AnswerDate)<=DATE(SC.EndAnswerPeriod) OR A.AnswerDate='0001-01-01 00:00:00') " +
			
			" WHERE D.Single=@single AND " + str + " ((Q.ParentQuestion=@emptyRef) OR Q.ParentQuestion IN (SELECT Question FROM Document_Visit_SKUs " +
			" WHERE (Answer='Yes' OR Answer='Да') AND Ref=@visit AND SKU=@sku) " + 
			" OR Q.ParentQuestion IN (SELECT Question FROM Catalog_Outlet_AnsweredQuestions " +
			" WHERE (Answer='Yes' OR Answer='Да') AND Ref=@outlet AND SKU=S.SKU)) " +
			" GROUP BY Q.ChildQuestion, Q.ChildDescription, Q.ChildType, Q.ParentQuestion, A.Answer " + 
			" ORDER BY DocDate, QuestionOrder ";
	q.AddParameter("emptyRef", DB.EmptyRef("Catalog_Question"));
	q.AddParameter("integer", DB.Current.Constant.DataType.Integer);
	q.AddParameter("decimal", DB.Current.Constant.DataType.Decimal);
	q.AddParameter("string", DB.Current.Constant.DataType.String);
	q.AddParameter("snapshot", DB.Current.Constant.DataType.Snapshot);	
	q.AddParameter("visit", $.workflow.visit);
	q.AddParameter("single", single);
	q.AddParameter("sku", sku);
	q.AddParameter("outlet", $.workflow.outlet);
	q.AddParameter("attached", Translate["#snapshotAttached#"]);
	
	return q.Execute();
}


//function AssignQuestionValue(control, sku, question) {
//	CreateVisitSKUValueIfNotExists(sku, question, control.Text)
//}

function RemovePlaceHolder(control) {
	if (control.Text == "—")
		control.Text = "";
}

function RefreshScreen(control, search) {
	Workflow.Refresh([search]);
}

// ------------------------SKU----------------------

function CreateItemAndShow(control, sku, index) {
	if (parentId == ("p"+index)){
		parentId = null;
		scrollIndex = null;
	}
	else
		parentId = "p" + index;
		
	scrollIndex = index;
	setScroll = true;
	
	Workflow.Refresh([$.search]);
}



function CreateVisitSKUValueIfNotExists(control, sku, question, isInput) {
	
//	if (isInput=='true' && (control.Text=="—" || TrimAll(control.Text)==""))
//		return null;
	
	doRefresh = true;
	
	var query = new Query();
	query.Text = "SELECT Id FROM Document_Visit_SKUs WHERE SKU=@sku AND Question=@question AND Ref=@ref";
	query.AddParameter("ref", $.workflow.visit);
	query.AddParameter("question", question);
	query.AddParameter("sku", sku);
	var skuValue = query.ExecuteScalar();
	
	if (skuValue == null){		
		skuValue = DB.Create("Document.Visit_SKUs");
		skuValue.Ref = $.workflow.visit;
		skuValue.SKU = sku;
		skuValue.Question = question;
	}
	else
		skuValue = skuValue.GetObject();
	skuValue.Answer = control.Text;
	skuValue.AnswerDate = DateTime.Now;
	skuValue.Save();
	
	setScroll = false;
	
	return skuValue.Id;
}

function GetSnapshotText(text) {
	if (String.IsNullOrEmpty(text))
		return Translate["#noSnapshot#"];
	else
		return Translate["#snapshotAttached#"];
}

function GoToQuestionAction(control, answerType, question, sku, editControl, currAnswer, currSKU) {	
	
	editControl = Variables[editControl];
	if (editControl.Text=="—"){
		editControl.Text = "";
	}
	var skuValue = CreateVisitSKUValueIfNotExists(editControl, sku, question, 'false');
	
	if ((answerType).ToString() == (DB.Current.Constant.DataType.ValueList).ToString()) {
		var q = new Query();
		q.Text = "SELECT Value, Value FROM Catalog_Question_ValueList WHERE Ref=@ref";
		q.AddParameter("ref", question);
		Dialogs.DoChoose(q.Execute(), skuValue, "Answer", editControl, DialogCallBack);
		//ValueListSelect(skuValue, "Answer", q.Execute(), editControl);
	}

	if ((answerType).ToString() == (DB.Current.Constant.DataType.Snapshot).ToString()) {
		skuValueGl = skuValue;
		var listChoice = new List;
		listChoice.Add([1, Translate["#makeSnapshot#"]]);
		if ($.sessionConst.galleryChoose)
			listChoice.Add([0, Translate["#addFromGallery#"]]);
		if (String.IsNullOrEmpty(skuValue.Answer)==false)
			listChoice.Add([2, Translate["#clearValue#"]]);
		Gallery.AddSnapshot($.workflow.visit, skuValue, SaveAtVisit, listChoice, "document.visit");
	}

	if ((answerType).ToString() == (DB.Current.Constant.DataType.DateTime).ToString()) {
		Dialogs.ChooseDateTime(skuValue, "Answer", editControl, DialogCallBack);
	}

	if ((answerType).ToString() == (DB.Current.Constant.DataType.Boolean).ToString()) {
		bool_answer = currAnswer;
		curr_item = skuValue;
		curr_sku = currSKU;
		Dialogs.ChooseBool(skuValue, "Answer", editControl, DialogCallBack);
	}
	
	setScroll = false;
}


function CheckEmtySKUAndForward(outlet, visit) {
	
	if (doRefresh) {
	
		Workflow.Refresh([]);
	
	} else {
		
		var p = [ outlet, visit ];
		
		parentId = null;		
		
		var q = regular_total + single_total;
		
		$.workflow.Add("questions_qty_sku", q);
		
		var a = regular_answ + single_answ;
		
		$.workflow.Add("questions_answ_sku", a);
		
		del = new Query("DELETE FROM USR_Filters");
		
		del.Execute();
		
		Workflow.Forward(p);
		
	}
	
}

function GetCameraObject(entity) {
	FileSystem.CreateDirectory("/private/document.visit");
	var guid = Global.GenerateGuid();
	//Variables.Add("guid", guid);
	var path = String.Format("/private/document.visit/{0}/{1}.jpg", entity.Id, guid);
	Camera.Size = 300;
	Camera.Path = path;
	return guid; 
}

function SaveAtVisit(arr, args) {
	var question = skuValueGl;
	var path = arr[1];
	if (args.Result) {
		question = question.GetObject();
		question.Answer = path;
		question.Save();
	}
	else
		question.Answer = null;
	Workflow.Refresh([$.search]);
}

function ObligatedAnswered(answer, obligatoriness) {
	if (parseInt(obligatoriness)==parseInt(1)){
		if (String.IsNullOrEmpty(answer)==false & answer!="—")
			return true;
	}
	return false;	
}

function GetActionAndBack() {
	if ($.workflow.skipQuestions) {
		if ($.workflow.skipTasks) {
			Workflow.BackTo("Outlet");
		} else
			Workflow.BackTo("Visit_Tasks");
	} else
		Workflow.BackTo("Questions");
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
	
	AssignDialogValue(state, args);
	
	var key = args.Result;
	
	if ((bool_answer=='Yes' || bool_answer=='Да') && (key=='No' || key=='Нет')){
		GetChildQuestions();
		var q3 = new Query("SELECT A.Id FROM Catalog_Outlet_AnsweredQuestions A " +
				" JOIN Document_Questionnaire_Schedule SC ON A.Questionaire=SC.Ref " +
				" WHERE A.Ref=@outlet AND A.SKU=@sku AND A.Question=@question AND DATE(A.AnswerDate)>=DATE(SC.BeginAnswerPeriod) " +
				" AND (DATE(A.AnswerDate)<=DATE(SC.EndAnswerPeriod) OR A.AnswerDate='0001-01-01 00:00:00')");
		q3.AddParameter("outlet", $.workflow.outlet);
		q3.AddParameter("question", curr_item.Question);
		q3.AddParameter("sku", curr_sku);
		var items = q3.Execute();
		
		while (items.Next()){
			var item = items.Id;
			item = item.GetObject();
			item.Answer = Translate["#NO#"];
			item.Save();
		}
	}
	if ((bool_answer=='Yes' || bool_answer=='Да') && key==null){
		GetChildQuestions();
		var q3 = new Query("SELECT A.Id FROM Catalog_Outlet_AnsweredQuestions A " +
				" JOIN Document_Questionnaire_Schedule SC ON A.Questionaire=SC.Ref " +
				" WHERE A.Ref=@outlet AND A.SKU=@sku AND A.Question=@question AND DATE(A.AnswerDate)>=DATE(SC.BeginAnswerPeriod) " +
				" AND (DATE(A.AnswerDate)<=DATE(SC.EndAnswerPeriod) OR A.AnswerDate='0001-01-01 00:00:00')");
		q3.AddParameter("outlet", $.workflow.outlet);
		q3.AddParameter("question", curr_item.Question);
		q3.AddParameter("sku", curr_sku);
		var items = q3.Execute();
		while (items.Next()){
			DB.Delete(items.Id);
		}
	}
	Workflow.Refresh([$.search]);
}
	
function GetChildQuestions() {
	var str = CreateCondition($.workflow.questionnaires, " Q.Ref ");
	var q = new Query("SELECT DISTINCT V.Id, Q.ChildDescription FROM Document_Visit_SKUs V " +
			" JOIN Document_Questionnaire_SKUQuestions Q ON V.Question=Q.ChildQuestion " +
			" JOIN Document_Questionnaire_SKUs S ON Q.Ref=S.Ref AND S.SKU=V.SKU " +
			" WHERE " + str + " V.Ref=@visit AND Q.ParentQuestion=@parent");			
	q.AddParameter("visit", $.workflow.visit);
	q.AddParameter("parent", curr_item.Question);
	var res1 = q.Execute();
	
	var q2 = new Query("SELECT DISTINCT A.Id, Q.ChildDescription FROM Catalog_Outlet_AnsweredQuestions A " +
			" JOIN Document_Questionnaire_SKUQuestions Q ON A.Question=Q.ChildQuestion " +
			//" JOIN Document_Questionnaire_SKUs S ON Q.Ref=S.Ref AND S.SKU=A.SKU " +
			" WHERE " + str + " A.Ref=@outlet AND Q.ParentQuestion=@parent AND A.SKU=@sku");
	q2.AddParameter("outlet", $.workflow.outlet);
	q2.AddParameter("parent", curr_item.Question);
	q2.AddParameter("sku", curr_sku);
	var res2 = q2.Execute();
	
	DeleteAnswers(res1);
	DeleteAnswers(res2);
}

function DeleteAnswers(recordset) {	
	while (recordset.Next()){
		DB.Delete(recordset.Id);
	}	
}
