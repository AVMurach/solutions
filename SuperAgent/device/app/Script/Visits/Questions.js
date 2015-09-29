var questionsAtScreen;
var regularAnswers;
var answerText;
var obligateredLeft;
var regular_answ;
var regular_total;
var single_answ;
var single_total;
var bool_answer;
var curr_item;
var questionGl;
var doRefresh;

//
// -------------------------------Header handlers-------------------------
//

function OnLoading() {
	doRefresh = false;
	questionsAtScreen = null;
	obligateredLeft = parseInt(0);
	SetListType();
}

function SetListType() {
	if (regularAnswers == null)
		regularAnswers = true;
}

function ChangeListAndRefresh(control, param) {
	regularAnswers = ConvertToBoolean1(param);
	Workflow.Refresh([]);
}


//
// --------------------------------Questions list handlers--------------------------
//

function GetQuestionsByQuestionnaires(outlet) {

	var str = CreateCondition($.workflow.questionnaires, " D.Id ");
	var strAnswered = CreateCondition($.workflow.questionnaires, " Aa.Questionaire ");
	
	var single = 1;
	if (regularAnswers)	
		single = 0;
	
	//find obligatered questions qty
	var queryCurr = new Query("SELECT DISTINCT Q.ChildQuestion, D.Single " +
		" FROM Document_Questionnaire D " +
		" JOIN Document_Questionnaire_Questions Q ON D.Id=Q.Ref " +
		" LEFT JOIN Document_Visit_Questions V ON V.Question=Q.ChildQuestion AND V.Ref=@visit " +
		" WHERE " + str + " ((Q.ParentQuestion=@emptyRef) " +
		" OR Q.ParentQuestion IN (SELECT Question FROM Document_Visit_Questions WHERE (Answer='Yes' OR Answer='Да') AND Ref=@visit) " +
		" OR Q.ParentQuestion IN (SELECT Aa.Question FROM Catalog_Outlet_AnsweredQuestions Aa " +
		" JOIN Document_Questionnaire_Schedule SC ON Aa.Questionaire=SC.Ref " +
		" WHERE (Aa.Answer='Yes' OR Aa.Answer='Да') AND Aa.Ref=@outlet AND Aa.Questionaire=D.Id AND Aa.SKU=@emptySKU AND DATE(Aa.AnswerDate)>=DATE(SC.BeginAnswerPeriod) " +
			" AND (DATE(Aa.AnswerDate)<=DATE(SC.EndAnswerPeriod) OR Aa.AnswerDate='0001-01-01 00:00:00'))) AND Obligatoriness=1 AND (Answer IS NULL OR Answer='—' OR Answer='') " +
		" GROUP BY Q.ChildQuestion, D.Single ");
	queryCurr.AddParameter("emptyRef", DB.EmptyRef("Catalog_Question"));
	queryCurr.AddParameter("visit", $.workflow.visit);
	queryCurr.AddParameter("outlet", $.workflow.outlet);
	queryCurr.AddParameter("emptySKU", DB.EmptyRef("Catalog_SKU"));
	
	var queryHist = new Query( " SELECT DISTINCT Aa.Question " +
			" FROM Catalog_Outlet_AnsweredQuestions Aa " +
			" JOIN Document_Questionnaire_Schedule SCc " +
			" JOIN Document_Questionnaire_Questions Q ON Q.Ref=SCc.Ref AND Aa.Question=Q.ChildQuestion " +
			" LEFT JOIN Document_Visit_Questions V ON V.Ref=@visit AND V.Question=Aa.Question " +
			" WHERE V.Ref IS NULL AND Aa.Ref=@outlet AND  Aa.SKU=@emptySKU AND " + strAnswered +
			" DATE(Aa.AnswerDate)>=DATE(SCc.BeginAnswerPeriod) " +
			" AND (DATE(Aa.AnswerDate)<=DATE(SCc.EndAnswerPeriod) OR Aa.AnswerDate='0001-01-01 00:00:00') AND Q.Obligatoriness='1'" +
			" AND (Q.ParentQuestion=@emptyRef OR (Q.ParentQuestion IN (SELECT CA.Question FROM Catalog_Outlet_AnsweredQuestions CA " +
			" WHERE (CA.Answer='Yes' OR CA.Answer='Да') AND CA.Ref=@outlet AND SKU=@emptySKU AND DATE(CA.AnswerDate)>=DATE(SCc.BeginAnswerPeriod) " +
			" AND (DATE(CA.AnswerDate)<=DATE(SCc.EndAnswerPeriod) OR CA.AnswerDate='0001-01-01 00:00:00')) AND Q.ParentQuestion NOT IN " +
			" (SELECT Question FROM Document_Visit_Questions " +
			" WHERE (Answer='No' OR Answer='Нет') AND Ref=@visit))) ");
	queryHist.AddParameter("outlet", $.workflow.outlet);
	queryHist.AddParameter("visit", $.workflow.visit);
	queryHist.AddParameter("emptyRef", DB.EmptyRef("Catalog_Question"));
	queryHist.AddParameter("emptySKU", DB.EmptyRef("Catalog_SKU"));		
	
	obligateredLeft = queryCurr.ExecuteCount() - queryHist.ExecuteCount();
	

	var res = GetQuestions(str, single);
	
	SetIndiactors(res, single, str);
	
	return res;
}

function GetQuestions(str, single) {
	var query = new Query("SELECT MIN(D.Date) AS DocDate, Q.ChildQuestion AS Question, Q.ChildDescription AS Description " +
			", Q.ChildType AS AnswerType, MAX(CAST(Q.Obligatoriness AS int)) AS Obligatoriness " +
			", (SELECT Qq.QuestionOrder FROM Document_Questionnaire Dd  " +
			" JOIN Document_Questionnaire_Questions Qq ON Dd.Id=Qq.Ref AND Q.ChildQuestion=Qq.ChildQuestion AND Dd.Id=D.Id ORDER BY Dd.Date LIMIT 1) AS QuestionOrder" +
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
			" JOIN Document_Questionnaire_Questions Q ON D.Id=Q.Ref " +
			" JOIN Document_Questionnaire_Schedule SC ON SC.Ref=D.Id AND date(SC.Date)=date('now','start of day') " +
			" LEFT JOIN Document_Visit_Questions V ON V.Question=Q.ChildQuestion AND V.Ref=@visit " + 
			" LEFT JOIN Catalog_Outlet_AnsweredQuestions A ON A.Ref = @outlet AND A.Questionaire=D.Id " +
			" AND A.Question=Q.ChildQuestion AND (A.SKU=@emptySKU OR A.SKU IS NULL) AND DATE(A.AnswerDate)>=DATE(SC.BeginAnswerPeriod) " +
			" AND (DATE(A.AnswerDate)<=DATE(SC.EndAnswerPeriod) OR A.AnswerDate='0001-01-01 00:00:00') " +
			
			" WHERE D.Single=@single AND " + str + " ((Q.ParentQuestion=@emptyRef) OR Q.ParentQuestion IN (SELECT Question FROM Document_Visit_Questions " +
			" WHERE (Answer='Yes' OR Answer='Да') AND Ref=@visit) " + 
			" OR (Q.ParentQuestion IN (SELECT Aa.Question FROM Catalog_Outlet_AnsweredQuestions Aa " +
			" WHERE (Aa.Answer='Yes' OR Aa.Answer='Да') AND Aa.Ref=@outlet AND Aa.Questionaire=D.Id AND Aa.SKU=@emptySKU AND DATE(A.AnswerDate)>=DATE(SC.BeginAnswerPeriod) " +
			" AND (DATE(A.AnswerDate)<=DATE(SC.EndAnswerPeriod) OR A.AnswerDate='0001-01-01 00:00:00')) " +
			"AND Q.ParentQuestion NOT IN (SELECT Question FROM Document_Visit_Questions " +
			" WHERE (Answer='No' OR Answer='Нет') AND Ref=@visit)))" +
			
			" GROUP BY Q.ChildQuestion, Q.ChildDescription, Q.ChildType, V.Answer " + 
			" ORDER BY DocDate, QuestionOrder ");
	query.AddParameter("emptyRef", DB.EmptyRef("Catalog_Question"));
	query.AddParameter("emptySKU", DB.EmptyRef("Catalog_SKU"));
	query.AddParameter("integer", DB.Current.Constant.DataType.Integer);
	query.AddParameter("decimal", DB.Current.Constant.DataType.Decimal);
	query.AddParameter("string", DB.Current.Constant.DataType.String);
	query.AddParameter("snapshot", DB.Current.Constant.DataType.Snapshot);
	query.AddParameter("visit", $.workflow.visit);
	query.AddParameter("single", single);	
	query.AddParameter("outlet", $.workflow.outlet);
	query.AddParameter("attached", Translate["#snapshotAttached#"]);
		
	return query.Execute().Unload();
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

function SetIndiactors(res, single, str) {
	if (parseInt(single)==parseInt(0)){
		regular_total = res.Count();
		var s = GetQuestions(str, 1);
		single_total = s.Count();
	}
	else{
		if (parseInt(single)==parseInt(1)){
			single_total = res.Count();	
			var r = GetQuestions(str, 0);
			regular_total = r.Count();
		}
	}
	regular_answ = GetAnsweredQty(0, str);
	single_answ = GetAnsweredQty(1, str);
	Variables.Add("workflow.questions_qty", (regular_total + single_total));
	Variables.Add("workflow.questions_answ", (regular_answ + single_answ));
}

function GetAnsweredQty(single, str) {
	
	var q = new Query; 
	
	var strUnion = "";
	if (parseInt(single)==parseInt(1)){
		var strAnswered = CreateCondition($.workflow.questionnaires, " A.Questionaire ");
		strUnion = " UNION " +
		" SELECT DISTINCT A.Question " +
		" FROM Catalog_Outlet_AnsweredQuestions A " +
		" JOIN Document_Questionnaire_Schedule SC ON A.Questionaire=SC.Ref " +
		" JOIN Document_Questionnaire_Questions Q ON Q.Ref=SC.Ref " +
		" WHERE DATE(A.AnswerDate)>=DATE(SC.BeginAnswerPeriod) AND (DATE(A.AnswerDate)<=DATE(SC.EndAnswerPeriod) OR A.AnswerDate='0001-01-01 00:00:00') " +
		" AND A.SKU=@emptySKU AND A.Ref=@outlet AND " + strAnswered +
		" (Q.ParentQuestion=@emptyRef OR Q.ParentQuestion IN (SELECT Question FROM Catalog_Outlet_AnsweredQuestions " +
			" WHERE (Answer='Yes' OR Answer='Да') AND Ref=A.Ref AND SKU=@emptySKU))";
		q.AddParameter("emptySKU", DB.EmptyRef("Catalog_SKU"));
		q.AddParameter("outlet", $.workflow.outlet);
	}

	q.Text = "SELECT DISTINCT Q.ChildQuestion FROM Document_Questionnaire D " +
			" JOIN Document_Questionnaire_Questions Q ON D.Id=Q.Ref " +
			" JOIN Document_Questionnaire_Schedule SC ON SC.Ref=D.Id AND date(SC.Date)=date('now','start of day') " +
			" JOIN Document_Visit_Questions V ON V.Question=Q.ChildQuestion AND V.Ref=@visit AND RTRIM(V.Answer)!='' AND V.Answer IS NOT NULL" + 
			" WHERE D.Single=@single AND " + str + 
			" (Q.ParentQuestion=@emptyRef OR Q.ParentQuestion IN (SELECT Question FROM Document_Visit_Questions  " +
				" WHERE (Answer='Yes' OR Answer='Да') AND Ref=@visit)) " + strUnion;
	q.AddParameter("emptyRef", DB.EmptyRef("Catalog_Question"));
	q.AddParameter("visit", $.workflow.visit);
	q.AddParameter("single", single);
	
//	if (parseInt(single)==parseInt(1)){
//		var strAnswered = CreateCondition($.workflow.questionnaires, " A.Questionaire ");
//		var histQuery = new Query("SELECT DISTINCT A.Question, V.Ref " +
//				" FROM Catalog_Outlet_AnsweredQuestions A " +
//				" JOIN Document_Questionnaire_Schedule SC ON A.Questionaire=SC.Ref " +
//				" JOIN Document_Questionnaire_Questions Q ON Q.Ref=SC.Ref " +
//				" LEFT JOIN Document_Visit_Questions V ON A.Question=V.Question AND V.Ref=@visit " +
//				" WHERE DATE(A.AnswerDate)>=DATE(SC.BeginAnswerPeriod) AND (DATE(A.AnswerDate)<=DATE(SC.EndAnswerPeriod) OR A.AnswerDate='0001-01-01 00:00:00') " +
//				" AND A.SKU=@emptySKU AND A.Ref=@outlet AND " + strAnswered + " V.Ref IS NULL " +
//				" AND (Q.ParentQuestion=@emptyRef OR Q.ParentQuestion IN (SELECT Question FROM Catalog_Outlet_AnsweredQuestions " +
//					" WHERE (Answer='Yes' OR Answer='Да') AND Ref=A.Ref AND SKU=@emptySKU)  OR Q.ParentQuestion IN (SELECT Question FROM Document_Visit_Questions  " +
//				" WHERE (Answer='Yes' OR Answer='Да') AND Ref=@visit))");
//				histQuery.AddParameter("emptyRef", DB.EmptyRef("Catalog_Question"));
//				histQuery.AddParameter("outlet", $.workflow.outlet);
//				histQuery.AddParameter("visit", $.workflow.visit);
//				histQuery.AddParameter("emptySKU", DB.EmptyRef("Catalog_SKU"));
//				
//				Dialog.Debug(histQuery.ExecuteCount());				
//				
//		return (histQuery.ExecuteCount() + q.ExecuteCount());
//	}
//	else{
		return q.ExecuteCount();
//	}
}

function RemovePlaceHolder(control) {
	if (control.Text == "—")
		control.Text = "";
}

function UniqueQuestion(question, answerType, answer, obligatered) {	
	// set answer text
	if (answerType == 'Snapshot')
		answerText = GetSnapshotText(answer);
	else
		answerText = answer;

	return result;
}


function ForwardIsntAllowed() {
	if (parseInt(obligateredLeft)!=parseInt(0))
		return true;
	else
		return false;
}

function CreateVisitQuestionValueIfNotExists(question, answer, dialogInput) {

	var query = new Query("SELECT Id FROM Document_Visit_Questions WHERE Ref == @Visit AND Question == @Question");
	query.AddParameter("Visit", $.workflow.visit);
	query.AddParameter("Question", question);
	var result = query.ExecuteScalar();
	if (result == null) {
		if (dialogInput || (answer!="—" && TrimAll(answer)!="")) {
			var p = DB.Create("Document.Visit_Questions");
			p.Ref = $.workflow.visit;
			p.Question = question;
			p.AnswerDate = DateTime.Now;
			p.Answer = answer;
			p.Save();
			result = p.Id;
			return result;
		}		
	}
	else{
		if ((answer=="—" || TrimAll(answer)=="") && dialogInput==false)
			DB.Delete(result);
		else{
			var p = result.GetObject();
			p.AnswerDate = DateTime.Now;
			p.Answer = answer;
			p.Save();
			result = p.Id;
			return result;
		}
	}	

}

function GetSnapshotText(text) {
	if (String.IsNullOrEmpty(text))
		return Translate["#noSnapshot#"];
	else
		return Translate["#snapshotAttached#"];
}

function GoToQuestionAction(answerType, visit, control, questionItem, currAnswer) {
	
	var editControl = Variables[control];
	if (editControl.Text=="—")
		editControl.Text = "";
	
	var question = CreateVisitQuestionValueIfNotExists(questionItem, editControl.Text, true);

	if ((answerType).ToString() == (DB.Current.Constant.DataType.ValueList).ToString()) {
		var q = new Query();
		q.Text = "SELECT Value, Value FROM Catalog_Question_ValueList WHERE Ref=@ref";
		q.AddParameter("ref", questionItem);
		
		ValueListSelect(question, "Answer", q.Execute(), Variables[control]);
	}

	if ((answerType).ToString() == (DB.Current.Constant.DataType.Snapshot).ToString()) {
		questionGl = question;
		var listChoice = new List;
		listChoice.Add([1, Translate["#makeSnapshot#"]]);
		if ($.sessionConst.galleryChoose)
			listChoice.Add([0, Translate["#addFromGallery#"]]);
		if (String.IsNullOrEmpty(question.Answer)==false)
			listChoice.Add([2, Translate["#clearValue#"]]);		
		Gallery.AddSnapshot(visit, question, SaveAtVisit, listChoice, "document.visit");
	}

	if ((answerType).ToString() == (DB.Current.Constant.DataType.DateTime).ToString()) {
		DateTimeDialog(question, "Answer", question.Answer, Variables[control]);
	}

	if ((answerType).ToString() == (DB.Current.Constant.DataType.Boolean).ToString()) {
		bool_answer = currAnswer;
		curr_item = question;
		BooleanDialogSelect(question, "Answer", Variables[control]);
	}

}

function AssignQuestionValue(control, question) {
	doRefresh = true;
	
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
	
	CreateVisitQuestionValueIfNotExists(question, control.Text, false);
}

function DialogCallBack(control, key) {
	if ((bool_answer=='Yes' || bool_answer=='Да') && (key=='No' || key=='Нет')){
		GetChildQuestions();
		var q3 = new Query("SELECT A.Id FROM Catalog_Outlet_AnsweredQuestions A " +
				" JOIN Document_Questionnaire_Schedule SC ON A.Questionaire=SC.Ref " +
				" WHERE A.Ref=@outlet AND A.Question=@question AND A.SKU=@emptySKU AND DATE(A.AnswerDate)>=DATE(SC.BeginAnswerPeriod) " +
				" AND (DATE(A.AnswerDate)<=DATE(SC.EndAnswerPeriod) OR A.AnswerDate='0001-01-01 00:00:00')");
		q3.AddParameter("outlet", $.workflow.outlet);
		q3.AddParameter("question", curr_item.Question);
		q3.AddParameter("emptySKU", DB.EmptyRef("Catalog_SKU"));
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
				" WHERE A.Ref=@outlet AND A.Question=@question AND A.SKU=@emptySKU AND DATE(A.AnswerDate)>=DATE(SC.BeginAnswerPeriod) " +
				" AND (DATE(A.AnswerDate)<=DATE(SC.EndAnswerPeriod) OR A.AnswerDate='0001-01-01 00:00:00')");
		q3.AddParameter("outlet", $.workflow.outlet);
		q3.AddParameter("question", curr_item.Question);
		q3.AddParameter("emptySKU", DB.EmptyRef("Catalog_SKU"));
		var items = q3.Execute();
		
		while (items.Next()){
			DB.Delete(items.Id);
		}
		
	}
	Workflow.Refresh([]);
}

function SaveAtVisit(arr, args) {	
	var question = questionGl;
	var  path = arr[1];
	if (args.Result) {
		question = question.GetObject();
		question.Answer = path;
		question.Save();
	}
	else
		question.Answer = null;
	Workflow.Refresh([]);
}

function GetChildQuestions() {
	var str = CreateCondition($.workflow.questionnaires, " Q.Ref ");
	var q = new Query("SELECT DISTINCT V.Id, Q.ChildDescription FROM Document_Visit_Questions V " +
			" JOIN Document_Questionnaire_Questions Q ON V.Question=Q.ChildQuestion " +
			" WHERE " + str + " V.Ref=@visit AND Q.ParentQuestion=@parent");			
	q.AddParameter("visit", $.workflow.visit);
	q.AddParameter("parent", curr_item.Question);
	var res1 = q.Execute();
	
	var q2 = new Query("SELECT DISTINCT A.Id, Q.ChildDescription FROM Catalog_Outlet_AnsweredQuestions A " +
			" JOIN Document_Questionnaire_Questions Q ON A.Question=Q.ChildQuestion " +
			" WHERE " + str + " A.Ref=@outlet AND Q.ParentQuestion=@parent AND A.SKU=@emptySKU");
	q2.AddParameter("outlet", $.workflow.outlet);
	q2.AddParameter("parent", curr_item.Question);
	q2.AddParameter("emptySKU", DB.EmptyRef("Catalog_SKU"));
	var res2 = q2.Execute();
	
	var q3 = new Query("SELECT A.Id FROM Catalog_Outlet_AnsweredQuestions A " +
			" JOIN Document_Questionnaire_Schedule SC ON A.Questionaire=SC.Ref " +
			" WHERE A.Ref=@outlet AND A.Question=@question AND A.SKU=@emptySKU AND DATE(A.AnswerDate)>=DATE(SC.BeginAnswerPeriod) " +
			" AND (DATE(A.AnswerDate)<=DATE(SC.EndAnswerPeriod) OR A.AnswerDate='0001-01-01 00:00:00')");
	q3.AddParameter("outlet", $.workflow.outlet);
	q3.AddParameter("question", curr_item.Question);
	q3.AddParameter("emptySKU", DB.EmptyRef("Catalog_SKU"));
	var items = q3.Execute();
	
	while (items.Next()){
		var item = items.Id;
		item = item.GetObject();
		item.Answer = Translate["#NO#"];
		item.Save();
	}
	
	DeleteAnswers(res1);
	DeleteAnswers(res2);
}

function DeleteAnswers(recordset) {	
	while (recordset.Next()){
		DB.Delete(recordset.Id);
	}	
}

/*
 * function SaveValue(control, questionValue){ questionValue =
 * questionValue.GetObject(); questionValue.Save(); }
 */

function GetCameraObject(entity) {
	FileSystem.CreateDirectory("/private/document.visit");
	var guid = Global.GenerateGuid();
	Variables.Add("guid", guid);
	var path = String.Format("/private/document.visit/{0}/{1}.jpg", entity.Id, guid);
	Camera.Size = 300;
	Camera.Path = path;
}

function CheckEmptyQuestionsAndForward(visit) {
	
	if (doRefresh){
		Workflow.Refresh([]);

	}
	else{
		var qr = new Query("SELECT Id FROM Document_Visit_Questions WHERE Answer IS NULL  OR Answer=''");
		var res = qr.Execute();
	
		while (res.Next()) {
			DB.Delete(res.Id);
		}
	
		Workflow.Forward([]);
	}
}


function GetActionAndBack() {
	if ($.workflow.skipTasks) {
		Workflow.BackTo("Outlet");
	} else
		Workflow.Back();
}

function ObligatedAnswered(answer, obligatoriness) {
	if (parseInt(obligatoriness)==parseInt(1)){
		if (String.IsNullOrEmpty(answer)==false & answer!="—")
			return true;
	}
	return false;	
}