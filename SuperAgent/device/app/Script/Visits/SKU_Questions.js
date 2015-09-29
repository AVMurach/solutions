var skuOnScreen;
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

	var str = CreateCondition($.workflow.questionnaires, " D.Id ");
	var strAnswered = CreateCondition($.workflow.questionnaires, " Aa.Questionaire ");
	var single = 1;
	if (regularAnswers)	
		single = 0;
	
	SetIndicators(str, single);
	
	var queryQty = new Query( "SELECT DISTINCT Q.ChildQuestion, S.SKU " +
			" FROM Document_Questionnaire D " +
			" JOIN Document_Questionnaire_SKUQuestions Q ON D.Id=Q.Ref " +
			" JOIN Document_Questionnaire_SKUs S ON S.Ref=D.Id " +
			" LEFT JOIN Document_Visit_SKUs V ON V.Question=Q.ChildQuestion AND S.SKU=V.SKU " +
			" AND V.Ref=@visit " +
			" WHERE " + str + " ((Q.ParentQuestion=@emptyRef) OR Q.ParentQuestion IN (SELECT Question FROM Document_Visit_SKUs Vv" +
			" WHERE (Answer='Yes' OR Answer='Да') AND Ref=@visit AND Vv.SKU=S.SKU) " +
			" OR Q.ParentQuestion IN (SELECT Question FROM Catalog_Outlet_AnsweredQuestions " +
				" WHERE (Answer='Yes' OR Answer='Да') AND Ref=@outlet AND SKU=S.SKU) " +
			" ) AND Obligatoriness=1 " +
			" AND (Answer IS NULL OR Answer='—' OR Answer='')");
	queryQty.AddParameter("emptyRef", DB.EmptyRef("Catalog_Question"));
	queryQty.AddParameter("visit", $.workflow.visit);
	queryQty.AddParameter("outlet", $.workflow.outlet);
	
	var queryHist = new Query( " SELECT DISTINCT Aa.Question, Aa.SKU " +
			" FROM Catalog_Outlet_AnsweredQuestions Aa " +
			" JOIN Document_Questionnaire_Schedule SCc " +
			" JOIN Document_Questionnaire_SKUQuestions Q ON Q.Ref=SCc.Ref AND Aa.Question=Q.ChildQuestion " +
			" LEFT JOIN Document_Visit_SKUs V ON V.Ref=@visit AND V.Question=Aa.Question AND V.SKU=Aa.SKU " +
			" WHERE V.Ref IS NULL AND Aa.Ref=@outlet AND " + strAnswered +
			" DATE(Aa.AnswerDate)>=DATE(SCc.BeginAnswerPeriod) " +
			" AND (DATE(Aa.AnswerDate)<=DATE(SCc.EndAnswerPeriod) OR Aa.AnswerDate='0001-01-01 00:00:00') AND Q.Obligatoriness='1'" +
			" AND (Q.ParentQuestion=@emptyRef OR Q.ParentQuestion IN (SELECT Question FROM Catalog_Outlet_AnsweredQuestions " +
			" WHERE (Answer='Yes' OR Answer='Да') AND Ref=Aa.Ref AND DATE(AnswerDate)>=DATE(SCc.BeginAnswerPeriod) " +
			" AND (DATE(AnswerDate)<=DATE(SCc.EndAnswerPeriod) OR AnswerDate='0001-01-01 00:00:00'))) ");
	queryHist.AddParameter("outlet", $.workflow.outlet);
	queryHist.AddParameter("visit", $.workflow.visit);
	queryHist.AddParameter("emptyRef", DB.EmptyRef("Catalog_Question"));
//	Dialog.Debug(queryQty.ExecuteCount());
	//Dialog.Debug(queryHist.ExecuteCount());
	
	obligateredLeft = queryQty.ExecuteCount() - queryHist.ExecuteCount();
	
	var searchString = "";
	if (String.IsNullOrEmpty(search) == false)
		searchString = " Contains(S.Description, '" + search + "') AND ";
	
	var filterString = "";
	var filterJoin = "";
	filterString += AddFilter(filterString, "group_filter", "GR.Id", " AND ");
	filterString += AddFilter(filterString, "brand_filter", "BR.Id", " AND ");
	if (String.IsNullOrEmpty(filterString)==false)
		filterJoin = " JOIN Catalog_SKU SK ON SK.Id=S.SKU " +
		" JOIN Catalog_Brands BR ON BR.Id=SK.Brand " +
		" JOIN Catalog_SKUGroup GR ON SK.Owner=GR.Id ";
	
	var q = new Query();
	q.Text="SELECT DISTINCT S.SKU, S.Description " +
			" , MAX(CASE WHEN Q.Obligatoriness=1 THEN CASE WHEN (VS.Answer!='—' AND VS.Answer!='' AND VS.Answer IS NOT NULL) THEN 1 ELSE 2 END ELSE 0 END) AS Obligatoriness " +
			" , (SELECT COUNT(DISTINCT Q.ChildQuestion) FROM Document_Questionnaire D " +
				" JOIN Document_Questionnaire_SKUQuestions Q ON D.Id=Q.Ref" +
				" JOIN Document_Questionnaire_SKUs Ss ON Ss.Ref=D.Id " +
				" WHERE D.Single=@single AND " + str + " Ss.SKU=S.SKU AND (Q.ParentQuestion=@emptyRef " +
				" OR Q.ParentQuestion IN (SELECT Question FROM Document_Visit_SKUs " +
				" WHERE (Answer='Yes' OR Answer='Да') AND Ref=@visit AND SKU=S.SKU) OR (Q.ParentQuestion IN (SELECT Question FROM Catalog_Outlet_AnsweredQuestions " +
				" WHERE (Answer='Yes' OR Answer='Да') AND Ref=@outlet AND Questionaire=D.Id AND SKU=S.SKU) AND Q.ParentQuestion NOT IN (SELECT Question FROM Document_Visit_SKUs " +
					" WHERE (Answer='No' OR Answer='Нет') AND Ref=@visit AND SKU=S.SKU)))) AS Total " +
			" , (SELECT COUNT(DISTINCT Q.ChildQuestion) FROM Document_Questionnaire D " +
				" JOIN Document_Questionnaire_SKUQuestions Q ON D.Id=Q.Ref" +
				" JOIN Document_Questionnaire_SKUs Ss ON Ss.Ref=D.Id " +
				" WHERE D.Single=@single AND Ss.SKU=S.SKU AND (Q.ParentQuestion=@emptyRef " +
				" OR Q.ParentQuestion IN (SELECT Question FROM Document_Visit_SKUs " +
				" WHERE (Answer='Yes' OR Answer='Да') AND Ref=@visit AND SKU=S.SKU) OR Q.ParentQuestion IN (SELECT Question FROM Catalog_Outlet_AnsweredQuestions " +
				" WHERE (Answer='Yes' OR Answer='Да') AND Ref=@outlet AND SKU=S.SKU) ) AND Q.Obligatoriness=1) AS ObligateredTotal " +	
			" , (SELECT COUNT(DISTINCT Q.ChildQuestion) FROM Document_Questionnaire D " +
				" JOIN Document_Questionnaire_SKUQuestions Q ON D.Id=Q.Ref" +
				" JOIN Document_Questionnaire_SKUs Ss ON Ss.Ref=D.Id " +
				" JOIN Document_Visit_SKUs V ON Ss.SKU=V.SKU AND Q.ChildQuestion=V.Question AND RTRIM(V.Answer)!='' AND V.Answer IS NOT NULL " +
				" WHERE D.Single=@single AND Ss.SKU=S.SKU AND (Q.ParentQuestion=@emptyRef " +
				" OR Q.ParentQuestion IN (SELECT Question FROM Document_Visit_SKUs " +
				" WHERE (Answer='Yes' OR Answer='Да') AND Ref=@visit AND SKU=S.SKU)) AND V.Ref=@visit AND Q.Obligatoriness='1') AS ObligateredCurrent " +
			" , (SELECT COUNT(DISTINCT Q.ChildQuestion) FROM Document_Questionnaire D " +
				" JOIN Document_Questionnaire_SKUQuestions Q ON D.Id=Q.Ref" +
				" JOIN Document_Questionnaire_SKUs Ss ON Ss.Ref=D.Id " +
				" JOIN Document_Visit_SKUs V ON Ss.SKU=V.SKU AND Q.ChildQuestion=V.Question AND RTRIM(V.Answer)!='' AND V.Answer IS NOT NULL " +
				" WHERE D.Single=@single AND Ss.SKU=S.SKU AND (Q.ParentQuestion=@emptyRef " +
				" OR Q.ParentQuestion IN (SELECT Question FROM Document_Visit_SKUs " +
				" WHERE (Answer='Yes' OR Answer='Да') AND Ref=@visit AND SKU=S.SKU)) AND V.Ref=@visit) AS Answered " +	
			" , (SELECT COUNT(DISTINCT Aa.Question) FROM Catalog_Outlet_AnsweredQuestions Aa " +
				" JOIN Document_Questionnaire_Schedule SCc " +
				" LEFT JOIN Document_Visit_SKUs V ON V.Ref=@visit AND V.Question=Aa.Question AND V.SKU=Aa.SKU " +
				" WHERE V.Ref IS NULL AND Aa.Ref=@outlet AND " + strAnswered + " Aa.SKU=S.SKU " +
				" AND DATE(Aa.AnswerDate)>=DATE(SCc.BeginAnswerPeriod) " +
				" AND (DATE(Aa.AnswerDate)<=DATE(SCc.EndAnswerPeriod) OR Aa.AnswerDate='0001-01-01 00:00:00')) AS History " +
			" , (SELECT COUNT(DISTINCT Aa.Question) FROM Catalog_Outlet_AnsweredQuestions Aa " +
				" JOIN Document_Questionnaire_Schedule SCc " +
				" JOIN Document_Questionnaire_SKUQuestions Q ON Q.Ref=Scc.Ref AND Aa.Question=Q.ChildQuestion " +
				" WHERE Aa.Ref=@outlet AND " + strAnswered + " Aa.SKU=S.SKU " +
				" AND DATE(Aa.AnswerDate)>=DATE(SCc.BeginAnswerPeriod) " +
				" AND (DATE(Aa.AnswerDate)<=DATE(SCc.EndAnswerPeriod) OR Aa.AnswerDate='0001-01-01 00:00:00') " +
				" AND (Q.ParentQuestion=@emptyRef OR Q.ParentQuestion IN (SELECT Question FROM Catalog_Outlet_AnsweredQuestions " +
				" WHERE (Answer='Yes' OR Answer='Да') AND Ref=Aa.Ref AND SKU=Aa.SKU)) " +
				" AND Q.Obligatoriness='1') AS ObligateredHistory " +
			" FROM Document_Questionnaire D JOIN Document_Questionnaire_SKUs S ON D.Id=S.Ref " +
			" JOIN Document_Questionnaire_SKUQuestions Q ON D.Id=Q.Ref " + filterJoin +
			" LEFT JOIN Document_Visit_SKUs VS ON VS.SKU=S.SKU AND VS.Question=Q.ChildQuestion AND VS.Ref=@visit " +
			" WHERE D.Single=@single AND " + str + searchString + filterString +
			" ((Q.ParentQuestion=@emptyRef) OR Q.ParentQuestion IN (SELECT Question FROM Document_Visit_SKUs Vv " +
			" WHERE (Answer='Yes' OR Answer='Да') AND Ref=@visit AND Vv.SKU=S.SKU)) " +
			" GROUP BY S.SKU, S.Description ORDER BY S.Description"; 
	q.AddParameter("outlet", $.workflow.outlet);
	q.AddParameter("emptyRef", DB.EmptyRef("Catalog_Question"));
	q.AddParameter("visit", $.workflow.visit);
	q.AddParameter("single", single);	

	return q.Execute();
}

function CreateCondition(list, field) {
	var str = "";
	var notEmpty = false;
	
	for ( var quest in list) {	
		if (String.IsNullOrEmpty(str)==false){
			str = str + ", ";		
		}
		str = str + " '" + quest.ToString() + "' ";		
		notEmpty = true;
	}
	if (notEmpty){
		str = field + " IN ( " + str  + ") AND ";
	}
	
	return str;
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

function SetIndicators(str) {
	regular_total = CalculateTotal(str, '0', false);
	single_total = CalculateTotal(str, '1', false);		
	regular_answ = CalculateTotal(str, '0', true);
	single_answ = CalculateTotal(str, '1', true);
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
	if (Variables.Exists(filterName)) {
		if (parseInt(Variables[filterName].Count()) != parseInt(0)) {
			var gr = Variables[filterName];
			filterString = condition + " IN (";
			for (var i = 0; i < gr.Count(); i++) {
				filterString += "'" + (gr[i]).ToString() + "'";
				if (i != (gr.Count() - 1))
					filterString += ", ";
				else
					filterString += ")" + connector;
			}
		}
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
			" GROUP BY Q.ChildQuestion, Q.ChildDescription, Q.ChildType, Q.ParentQuestion, Answer " + 
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


function AssignQuestionValue(control, sku, question) {
	//AVMurach+
		var textText = control.Text;
		var textCount = StrLen(textText);
		if(textCount > 100){
			control.Text = Mid(textText, 1, 100);
			Dialog.Message("Текст не должен превышать 100 символов");
			return 0;
		}else{
			return 0;
		}		
	//AVMurach-
	
	CreateVisitSKUValueIfNotExists(sku, question, control.Text)
}

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
		ValueListSelect(skuValue, "Answer", q.Execute(), editControl);
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
		DateTimeDialog(skuValue, "Answer", skuValue.Answer, editControl);
	}

	if ((answerType).ToString() == (DB.Current.Constant.DataType.Boolean).ToString()) {
		bool_answer = currAnswer;
		curr_item = skuValue;
		curr_sku = currSKU;
		BooleanDialogSelect(skuValue, "Answer", editControl);
	}
	
	setScroll = false;
}


function CheckEmtySKUAndForward(outlet, visit) {
	if (doRefresh) {
		Workflow.Refresh([]);
	}
	else{
		var p = [ outlet, visit ];
		parentId = null;		
		var q = regular_total + single_total;
		$.workflow.Add("questions_qty_sku", q);
		
		var a = regular_answ + single_answ;
		$.workflow.Add("questions_answ_sku", a);
		
		Variables.Remove("group_filter");
		Variables.Remove("brand_filter");
		
		//hotfix Murach A+
		q = new Query("DELETE FROM _Document_Visit_SKUs " +
				"WHERE Ref == @visit AND (Answer IS NULL OR Answer='—' OR Answer='') " +
				"");
		q.AddParameter("visit", visit);
		q.Execute();
		//hotfix Murach A-
		
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

function DialogCallBack(control, key){
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
