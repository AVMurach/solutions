var questionsAtScreen;
var regularAnswers;
var answerText;
var obligateNumber;
var forwardIsntAllowed;
var obligateBool;
var regular_answ;
var regular_total;
var single_answ;
var single_total;
var bool_answer;
var curr_item;
var questionGl;

//
// -------------------------------Header handlers-------------------------
//

function OnLoading() {
	questionsAtScreen = null;
	obligateNumber = '0';
	forwardIsntAllowed = false;
	SetIndiactors();
	SetListType();
}

function SetListType() {
	if (regularAnswers == null)
	{
		if (parseInt(regular_total) == parseInt(0))
			regularAnswers = false;
		else
			regularAnswers = true;
	}
}

function ChangeListAndRefresh(control, param) {
	regularAnswers = ConvertToBoolean1(param);
	Workflow.Refresh([]);
}

//
// --------------------------------Questions list handlers--------------------------
//

function GetQuestionsByQuestionnaires(outlet) {

	var oblQuest = new Query("SELECT COUNT(DISTINCT Question) FROM USR_Questions WHERE Obligatoriness=1 AND TRIM(IFNULL(Answer, '')) = '' " +
			"AND (ParentQuestion=@emptyRef OR ParentQuestion IN (SELECT Question FROM USR_Questions " +
			"WHERE (Answer='Yes' OR Answer='Да')))");
	oblQuest.AddParameter("emptyRef", DB.EmptyRef("Catalog_Question"));

	obligateNumber = oblQuest.ExecuteScalar().ToString();

	if (obligateNumber!='0') {
		forwardIsntAllowed = true;
	}	else {
		forwardIsntAllowed = false;
	}

	var single = 1;

	if (regularAnswers) {
		single = 0;
	}

	// SetIndiactors();

	return GetQuestions(single);

}

function GetQuestions(single) {

	var q = new Query("SELECT UQ.Answer, UQ.AnswerType , UQ.Question, UQ.Description, UQ.Obligatoriness, UQ.IsInputField, UQ.KeyboardType, " +
			"CASE WHEN UQ.IsInputField='1' THEN UQ.Answer ELSE " +
				"CASE WHEN TRIM(IFNULL(UQ.Answer, '')) != '' THEN UQ.Answer ELSE '—' END END AS AnswerOutput, " +
			"CASE WHEN UQ.AnswerType=@snapshot THEN " +
				"CASE WHEN TRIM(IFNULL(VFILES.FullFileName, '')) != '' THEN LOWER(VFILES.FullFileName) ELSE " +
					"CASE WHEN TRIM(IFNULL(OFILES.FullFileName, '')) != '' THEN LOWER(OFILES.FullFileName) ELSE '/shared/result.jpg' END END ELSE NULL END AS FullFileName " +
			"FROM USR_Questions UQ " +
			"LEFT JOIN Document_Visit_Files VFILES ON VFILES.FileName = UQ.Answer AND VFILES.Ref = @visit " +
			"LEFT JOIN Catalog_Outlet_Files OFILES ON OFILES.FileName = UQ.Answer AND OFILES.Ref = @outlet " +
			"WHERE UQ.Single=@single AND (UQ.ParentQuestion=@emptyRef OR UQ.ParentQuestion IN (SELECT Question FROM USR_Questions " +
			"WHERE (Answer='Yes' OR Answer='Да'))) " +
			"ORDER BY UQ.DocDate, UQ.QuestionOrder ");

	q.AddParameter("emptyRef", DB.EmptyRef("Catalog_Question"));
	q.AddParameter("single", single);
	q.AddParameter("snapshot", DB.Current.Constant.DataType.Snapshot);
	q.AddParameter("visit", $.workflow.visit);
	q.AddParameter("outlet", $.workflow.outlet);

	return q.Execute();

}

function SetIndiactors() {

	var q = new Query("SELECT SUM(CASE WHEN Single = 0 THEN 1 ELSE 0 END) AS RegularTotal, " +
			"SUM(CASE WHEN Single = 1 THEN 1 ELSE 0 END) AS SingleTotal, " +
			"SUM(CASE WHEN Single = 0 AND TRIM(IFNULL(Answer, '')) != '' THEN 1 ELSE 0 END) AS RegularAnsw, " +
			"SUM(CASE WHEN Single = 1 AND TRIM(IFNULL(Answer, '')) != '' THEN 1 ELSE 0 END) AS SingleAnsw " +
			"FROM (SELECT DISTINCT Question, Single, Answer " +
				"FROM USR_Questions " +
				"WHERE ParentQuestion=@emptyRef OR ParentQuestion IN " +
					"(SELECT Question FROM USR_Questions WHERE (Answer='Yes' OR Answer='Да')))");

	q.AddParameter("emptyRef", DB.EmptyRef("Catalog_Question"));

	res = q.Execute();

	res.Next();

	regular_total = res.RegularTotal;
	single_total = res.SingleTotal;
	regular_answ = res.RegularAnsw;
	single_answ = res.SingleAnsw;

	Variables.Add("workflow.questions_qty", (regular_total + single_total));
	Variables.Add("workflow.questions_answ", (regular_answ + single_answ));

}

function HasQuestions(){
	if (regularAnswers && parseInt(regular_total)==parseInt(0))
		return false;
	if (!regularAnswers && parseInt(single_total)==parseInt(0))
		return false;
	return true;
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

	}	else {

		if ((answer=="—" || TrimAll(answer)=="") && dialogInput==false) {

			DB.Delete(result);

		} else{

			var p = result.GetObject();

			p.AnswerDate = DateTime.Now;
			p.Answer = answer;

			p.Save();

			result = p.Id;

			return result;

		}

	}

}

function GoToQuestionAction(answerType, visit, control, questionItem, currAnswer, questionDescription) {

	if (answerType == DB.Current.Constant.DataType.ValueList) {

		var q = new Query();
		q.Text = "SELECT Value, Value FROM Catalog_Question_ValueList WHERE Ref=@ref UNION SELECT '', '—' ORDER BY Value";
		q.AddParameter("ref", questionItem);

		DoChoose(q.Execute(), questionItem, null, Variables[control], DialogCallBack, questionDescription);

	} else if (answerType == DB.Current.Constant.DataType.Snapshot) {

			questionGl = questionItem;

			var path = null;

			Images.AddQuestionSnapshot("USR_Questions", questionItem, null, currAnswer, true, questionDescription, GalleryCallBack);

	} else if (answerType == DB.Current.Constant.DataType.DateTime) {

		ChooseDateTime(questionItem, null, Variables[control], DialogCallBack, questionDescription);

	} else if (answerType == DB.Current.Constant.DataType.Boolean) {

		bool_answer = currAnswer;

		ChooseBool(questionItem, null, Variables[control], DialogCallBack, questionDescription);

	}

}

function FormatAndRefresh(control, question, answerType){

	var answer = control.Text;	

	if (!String.IsNullOrEmpty(answer) && answerType == DB.Current.Constant.DataType.Integer){

		control.Text = RoundToInt(answer);

		AssignAnswer(control, question, answer, answerType);
	}

	Workflow.Refresh([]);

}

function AssignAnswer(control, question, answer, answerType) {

	if (control != null) {
		answer = control.Text;
	} else{
		if (answer!=null)
			answer = answer.ToString();
	}
	if (answer == "—" || answer == "-")
		answer = null;

	var answerString;
	if (String.IsNullOrEmpty(answer))
		answerString = "HistoryAnswer ";
	else
		answerString = "@answer ";

	var q =	new Query("UPDATE USR_Questions SET Answer=" + answerString + ", AnswerDate=DATETIME('now', 'localtime') WHERE Question=@question");
	q.AddParameter("answer", (question.AnswerType == DB.Current.Constant.DataType.DateTime ? Format("{0:dd.MM.yyyy HH:mm}", Date(answer)) : answer));
	q.AddParameter("question", question);
	q.Execute();
}

function DialogCallBack(state, args) {
	var entity = state[0];
	AssignAnswer(null, entity, args.Result);

	Workflow.Refresh([]);
}

function GalleryCallBack(state, args) {
	if (args.Result) {
		AssignAnswer(null, questionGl, state[1]);

		newFile = DB.Create("Document.Visit_Files");
		newFile.Ref = state[0];
		newFile.FileName = state[1];
		newFile.FullFileName = state[2];
		newFile.Save();

		Workflow.Refresh([]);
	}
}

function GetCameraObject(entity) {
	FileSystem.CreateDirectory("/private/document.visit");
	var guid = GenerateGuid();
	Variables.Add("guid", guid);
	var path = String.Format("/private/document.visit/{0}/{1}.jpg", entity.Id, guid);
	Camera.Size = 300;
	Camera.Path = path;
	return guid;
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

function SnapshotExists(filename) {

	return FileSystem.Exists(filename);

}

//--------------------------------Gallery handlers----------------

//function AddSnapshot(objectRef, valueRef, func, listChoice, objectType, title) {
//	title = typeof title !== 'undefined' ? title : "#select_answer#";
//	Dialog.Choose(title, listChoice, AddSnapshotHandler, [objectRef,func,valueRef,objectType]);
//}

function AddSnapshotHandler(state, args) {
	var objRef = state[0];
	var func = state[1];
	//var valueRef = state[2];
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
		AssignAnswer(null, questionGl, null);
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
