
var checkOrderReason;
var checkVisitReason;
var orderEnabled;
var returnEnabled;
var encashmentEnabled;

function OnLoading() {
	checkOrderReason = false;
	checkVisitReason = false;

	orderEnabled = OptionAvailable("SkipOrder");
	returnEnabled = OptionAvailable("SkipReturn");
	encashmentEnabled = OptionAvailable("SkipEncashment") && $.sessionConst.encashEnabled;

	if ($.sessionConst.NOR && NotEmptyRef($.workflow.visit.Plan) && OrderExists($.workflow.visit)==false && orderEnabled)
		checkOrderReason = true;
	if ($.sessionConst.UVR && IsEmptyValue($.workflow.visit.Plan))
		checkVisitReason = true;
}

function GetNextVisit(outlet){
	var q = new Query("SELECT Id, PlanDate FROM Document_MobileAppPlanVisit WHERE Outlet=@outlet AND DATE(PlanDate)>=DATE(@date) AND Transformed=0 LIMIT 1");
	q.AddParameter("outlet", outlet);
	q.AddParameter("date", DateTime.Now.Date);
	var res = q.Execute();
	if (res.Next())
		return res;
	else
		return null;

}

function OrderCheckRequired(visit, wfName) {
    if (visit.Plan.EmptyRef()==false && GetOrderControlValue() && OrderExists(visit) == false)
        return true;
    else
        return false;
}

function OrderExists(visit) {
    //var p = DB.Current.Document.Order.SelectBy("Visit", visit.Id).First();
    var q = new Query("SELECT Id FROM Document_Order WHERE Visit=@visit");
    q.AddParameter("visit", visit);
    var p = q.ExecuteScalar();
    if (p == null)
        return false;
    else
        return true;
}

function OptionAvailable(option) {
	var q = new Query("SELECT Value FROM USR_WorkflowSteps WHERE Value=0 AND Skip=@skip");
	q.AddParameter("skip", option);
	if (q.ExecuteScalar() == null)
		return false;
	else
		return true;
}

function SetDeliveryDate(order, control) {
    Dialogs.ChooseDateTime(order, "DeliveryDate", control, DeliveryDateCallBack, Translate["#deliveryDate#"]);
}

function FormatDate(value, format) {
	if (value != null)
		value = value.ToString();
	if (String.IsNullOrEmpty(value) || IsEmptyValue(value))
		return "—";
	else
		return Format("{0:" + format + "}", Date(value));
}

function DoSelect(outlet, attribute, control, title) {
	Dialogs.DoChoose(null, outlet, attribute, control, SelectCallBack, title);
}

function SelectCallBack(state, args) {
	AssignDialogValue(state, args);
	Workflow.Refresh([]);
}

function SetnextVisitDate(nextVisit, control){
	if (String.IsNullOrEmpty(nextVisit.Id))
		var nextDate = DateTime.Now;
	else
		var nextDate = nextVisit.PlanDate;
	Dialogs.ChooseDateTime(nextVisit, "PlanDate", control, NextDateHandler, Translate["#nextVisitDate#"]); //nextDate, NextDateHandler, [nextVisit, control]);
}

function GetOrderControlValue() {
    //var orderFillCheck = DB.Current.Catalog.MobileApplicationSettings.SelectBy("Code", "NOR").First();
    var q = new Query("SELECT LogicValue FROM Catalog_MobileApplicationSettings WHERE Code='ControlOrderReasonEnabled'");
    var uvr = q.ExecuteScalar();

    if (uvr == null)
        return false;
    else {
        if (parseInt(uvr) == parseInt(0))
            return false
        else
            return true;
    }
}

function CountDoneTasks(visit) {
    var query = new Query("SELECT Id FROM Document_Visit_Task WHERE Ref=@ref AND Result=@result");
    query.AddParameter("ref", visit);
    query.AddParameter("result", true);
    return query.ExecuteCount();
}

function CountTasks(outlet) {
    var query = new Query("SELECT Id FROM Document_Task WHERE PlanDate >= @planDate AND Outlet = @outlet");
    query.AddParameter("outlet", outlet);
    query.AddParameter("planDate", DateTime.Now.Date);
    return query.ExecuteCount();
}

function GetOrderSUM(order) {
    var query = new Query("SELECT SUM(Qty*Total) FROM Document_Order_SKUs WHERE Ref = @Ref");
    query.AddParameter("Ref", order);
    var sum = query.ExecuteScalar();
    return FormatValue(sum);
}

function GetReturnSum(returnDoc) {
	var query = new Query("SELECT SUM(Qty*Total) FROM Document_Return_SKUs WHERE Ref = @Ref");
	query.AddParameter("Ref", returnDoc);
	var sum = query.ExecuteScalar();
	return FormatValue(sum);
}

function CheckAndCommit(order, visit, wfName) {

	var check = VisitIsChecked(visit, order, wfName);

	if (check.Checked) {
        visit = visit.GetObject();
    	visit.EndTime = DateTime.Now;

        if (OrderExists(visit.Id)) {
            order.GetObject().Save();
        }

        CreateQuestionnaireAnswers();

        visit.Save();
        Workflow.Commit();
    }
    else
        Dialog.Message(check.Message);//Translate["#messageNulls#"]);

}


//--------------------------internal functions--------------


function NextDateHandler(state, args){

	var newVistPlan = state[0]; 

	if (newVistPlan.Id==null){
		newVistPlan = DB.Create("Document.MobileAppPlanVisit");
		newVistPlan.SR = $.common.UserRef;
		newVistPlan.Outlet = $.workflow.outlet;
		newVistPlan.Transformed = false;
		newVistPlan.Date = DateTime.Now;
	}
	else
		newVistPlan = newVistPlan.Id.GetObject();
	newVistPlan.PlanDate = args.Result;
	newVistPlan.Save();

	Workflow.Refresh([]);
}

function DeliveryDateCallBack(state, args){
	AssignDialogValue(state, args);
	$.deliveryDate.Text = Format("{0:D}", Date(args.Result));

}

function VisitIsChecked(visit, order, wfName) {

	var result = new Dictionary();
	result.Add("Checked", false);

    if (checkOrderReason && visit.ReasonForNotOfTakingOrder.EmptyRef())
    	result.Add("Message", Translate["#noOrder#"]);
    else {
        if (checkVisitReason && visit.ReasonForVisit.EmptyRef())
        	result.Add("Message", Translate["#visitReasonMessage#"]);
        else
            result.Checked = true;
    }

    return result;
}

function DialogCallBack(control, key){
	control.Text = key;
}

function ShowQuestionnaires() {
	var noQuestQuery = new Query("SELECT Value FROM USR_WorkflowSteps WHERE Skip = @SkipQuestions");
	noQuestQuery.AddParameter("SkipQuestions", "SkipQuestions");
	var noQuest = noQuestQuery.ExecuteScalar();

	var noSKUQuestQuery = new Query("SELECT Value FROM USR_WorkflowSteps WHERE Skip = @SkipSKUs");
	noSKUQuestQuery.AddParameter("SkipSKUs", "SkipSKUs");
	var noSKUQuest = noSKUQuestQuery.ExecuteScalar();

	if ((noQuest && noSKUQuest))
		return false;
	else
		return true;
}

function NoTasks(skipTasks) {
	var noTaskQuery = new Query("SELECT Value FROM USR_WorkflowSteps WHERE Skip = @SkipTask");
	noTaskQuery.AddParameter("SkipTask", "SkipTask");
	var noTask = noTaskQuery.ExecuteScalar();
	if (noTask)
		return false;
	else
		return true;
}


//------------------------------Questionnaires handlers------------------


function CreateQuestionnaireAnswers() {
	var q = new Query("SELECT DISTINCT Q.Question, Q.SKU AS SKU, Q.Description, Q.Answer, Q.HistoryAnswer, Q.AnswerDate " +
			", D.Number, D.Id AS Questionnaire, D.Single, A.Id AS AnswerId " +
			"FROM USR_SKUQuestions Q " +
			"JOIN Document_Questionnaire_SKUs DS ON Q.SKU=DS.SKU " +
			"JOIN Document_Questionnaire_SKUQuestions DQ ON Q.Question=DQ.ChildQuestion AND DS.Ref=DQ.Ref " +
			"JOIN USR_Questionnaires D ON DQ.Ref=D.Id AND D.Single=Q.Single " +
			"LEFT JOIN Catalog_Outlet_AnsweredQuestions A ON A.Question=Q.Question AND A.Questionaire=DQ.Ref " +
			"AND A.SKU=Q.SKU " +
			"AND A.Ref=@outlet " +
			"WHERE Q.Answer!='' AND RTRIM(Q.Answer) IS NOT NULL " +
			"AND (Q.ParentQuestion='@ref[Catalog_Question]:00000000-0000-0000-0000-000000000000' " +
			"OR Q.ParentQuestion IN (SELECT Question FROM USR_SKUQuestions WHERE (Answer='Yes' OR Answer='Да')))" +
			"UNION " +
			"SELECT DISTINCT Q.Question, NULL AS SKU, Q.Description, Q.Answer, Q.HistoryAnswer, Q.AnswerDate" +
			", D.Number, D.Id AS Questionnaire, D.Single, A.Id AS AnswerId " +
			"FROM USR_Questions Q " +
			"JOIN Document_Questionnaire_Questions DQ ON Q.Question=DQ.ChildQuestion " +
			"JOIN USR_Questionnaires D ON DQ.Ref=D.Id AND D.Single=Q.Single " +
			"LEFT JOIN Catalog_Outlet_AnsweredQuestions A ON A.Question=Q.Question AND A.Questionaire=DQ.Ref " +
			"AND A.SKU='@ref[Catalog_SKU]:00000000-0000-0000-0000-000000000000'" +
			"AND A.Ref=@outlet " +
			"WHERE Q.Answer!='' AND RTRIM(Q.Answer) IS NOT NULL " +
			"AND (Q.ParentQuestion='@ref[Catalog_Question]:00000000-0000-0000-0000-000000000000' " +
			"OR Q.ParentQuestion IN (SELECT Question FROM USR_Questions WHERE (Answer='Yes' OR Answer='Да')))");
	q.AddParameter("outlet", $.workflow.outlet);
	var answers = q.Execute();

	while (answers.Next()) {
		if (answers.Answer!=answers.HistoryAnswer){
			if (answers.SKU!=null){
				var p = DB.Create("Document.Visit_SKUs");
				p.SKU = answers.SKU;
			}
			else
				var p = DB.Create("Document.Visit_Questions");
			p.Ref = $.workflow.visit;
			p.Question = answers.Question;
			p.Answer = answers.Answer;
			p.AnswerDate = answers.AnswerDate;
			p.Questionnaire = answers.Questionnaire;
			p.Save();
			if (answers.Single==1){
				var a;
				if (answers.AnswerId == null){
					a = DB.Create("Catalog.Outlet_AnsweredQuestions");
					a.Ref = $.workflow.outlet;
					a.Questionaire = answers.Questionnaire;
					a.Question = answers.Question;
					if (answers.SKU!=null)
						a.SKU = answers.SKU;
				}
				else{
					a = answers.AnswerId;
					a = a.GetObject();
				}
				a.Answer = answers.Answer;
				a.AnswerDate = answers.AnswerDate;
				a.Save();
			}
		}
	}
}
