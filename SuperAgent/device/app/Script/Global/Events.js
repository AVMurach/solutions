// ------------------------ Application -------------------

function OnApplicationInit() {

	Global.SetSessionConstants();

	Indicators.SetIndicators();

	CreateIndexes();

}

function OnApplicationRestore(name){

	Indicators.SetIndicators();

	if ((name=="Visit" && $.Exists('outletScreen')) || name=="Outlet" || name=="CreateOutlet" || ((name=="Order" || name=="Return") && !$.Exists('executedOrder')))
		GPS.StartTracking();

}

function OnApplicationBackground(name){
	GPS.StopTracking();
}


// ------------------------ Events ------------------------

function OnWorkflowStart(name) {

	if ($.Exists("workflow"))
		$.Remove("workflow");
	Variables.AddGlobal("workflow", new Dictionary());
	Variables["workflow"].Add("name", name);

	if (name == "Visit" || name == "Outlet" || name=="CreateOutlet" || ((name=="Order" || name=="Return") && !$.Exists('executedOrder')))
	{
		StartTracking();		
		$.workflow.Add("outlet", GlobalWorkflow.GetOutlet());		
	}

	if (name=="Visit" || name=="Order" || name=="Return")
	{
		SetFilterIndex();
	}

	if (name == "Visit")
	{

		var outlet = $.workflow.outlet;

		CreateQuestionnareTable(outlet);
		CreateQuestionsTable(outlet);
		CreateSKUQuestionsTable(outlet);

		SetSteps(outlet);
	}

}

function OnWorkflowForward(name, lastStep, nextStep, parameters) {

	if (name = "Visit" && lastStep == "Outlet")
		GPS.StopTracking();
}

function OnWorkflowForwarding(workflowName, lastStep, nextStep, parameters) {

	if (workflowName == "Visit" && nextStep != "Outlet" && nextStep != "Total" && nextStep != "Total_Tasks")
	{
		var standart = AlternativeStep(nextStep);
		if (!standart)
			return false;
	}

	if (workflowName == "Main" && GlobalWorkflow.GetOutletIsCreated()) //for step between CreateOutlet and Outlet
	{
		CloseCreatedOutlet();
	}

	if (NextDoc(lastStep, nextStep)) //between Return and Order
	{
		Global.ClearFilter();
		GlobalWorkflow.SetMassDiscount(null);
	}

	WriteScreenName(nextStep);

	if ($.workflow.HasValue("curentStep"))
		$.workflow.Remove("curentStep");
	$.workflow.Add("curentStep", nextStep);

	return true;
}

function OnWorkflowFinish(name, reason) {

	RemoveVariables(name);

	if (name != "Main")
	{
		GPS.StopTracking();
	}

	if (name=="Visit" || name=="Order" || name=="Return")
	{
		Global.ClearFilter();
		GlobalWorkflow.SetMassDiscount(null);
	}

	if (name=="Visit")
	{
		ClearUSRTables();
	}
}

function OnWorkflowFinished(name, reason){
	Indicators.SetIndicators();
}

function OnWorkflowBack(workflow, lastStep, nextStep){

	if ($.workflow.HasValue("curentStep"))
		$.workflow.Remove("curentStep");
	$.workflow.Add("curentStep", nextStep);

	if (name = "Visit" && nextStep == "Outlet")
		GPS.StartTracking();

	WriteScreenName(nextStep);

	if (NextDoc(lastStep, nextStep)) //between Order and Return
	{
		Global.ClearFilter();
	}

}

function OnWorkflowPause(name) {
	Variables.Remove("workflow");
}


// ------------------------ Functions ------------------------

function StartTracking(){		

	GPS.StartTracking(-1);
}

function RemoveVariables(name){

	GlobalWorkflow.ClearVariables();

	Variables.Remove("workflow");

	if (name != "Main")
	{
		if (Variables.Exists("planVisit"))
			Variables.Remove("planVisit");
		if (Variables.Exists("steps"))
			Variables.Remove("steps");
		if (Variables.Exists("executedOrder"))
			Variables.Remove("executedOrder");
	}
}

function CreateIndexes() {

	var indexQuery = new Query("CREATE INDEX IF NOT EXISTS IND_QSKU ON _Document_Questionnaire_SKUs(Ref, SKU, IsTombstone); " +
														 "CREATE INDEX IF NOT EXISTS IND_AQ " +
																	"ON _Catalog_Outlet_AnsweredQuestions(IsTombstone, Ref, Questionaire, Question, AnswerDate); " +
														 "CREATE INDEX IF NOT EXISTS IND_SKUSSTOCK ON _Catalog_SKU_Stocks(Ref, Stock, IsTombstone); " +
														 "CREATE INDEX IF NOT EXISTS IND_PLREFSKU ON _Document_PriceList_Prices(Ref, SKU, IsTombstone); " +
														 "CREATE INDEX IF NOT EXISTS IND_SKUOWNERBRAND ON _Catalog_SKU(Id, Owner, Brand, IsTombstone); " +
														 "CREATE INDEX IF NOT EXISTS IND_SKUBRAND ON _Catalog_SKU(Id, Brand, IsTombstone); " +
														 "CREATE INDEX IF NOT EXISTS IND_SKUOWNER ON _Catalog_SKU(Id, Owner, IsTombstone); " +
														 "CREATE INDEX IF NOT EXISTS IND_SKUGROUPPARENT ON _Catalog_SKUGroup(Id, Parent, IsTombstone); " +
														 "CREATE INDEX IF NOT EXISTS IND_QSKUQ ON _Document_Questionnaire_Questions(Ref, ChildQuestion, IsTombstone); " +
														 "CREATE INDEX IF NOT EXISTS IND_QSKUSQ ON _Document_Questionnaire_SKUQuestions(Ref, ChildQuestion, IsTombstone); " +
														 "CREATE INDEX IF NOT EXISTS IND_AMREFOUTLET ON _Catalog_AssortmentMatrix_Outlets(Ref, Outlet, IsTombstone); " +
														 "CREATE INDEX IF NOT EXISTS IND_QSCHEDULE ON _Document_Questionnaire_Schedule(Ref, IsTombstone);" +
														 "CREATE INDEX IF NOT EXISTS IND_AMO ON _Catalog_AssortmentMatrix_Outlets(Ref, IsTombstone);" +
														 "CREATE INDEX IF NOT EXISTS IND_AMS ON _Catalog_AssortmentMatrix_SKUs(Ref, IsTombstone)");
	indexQuery.Execute();

}

function SetFilterIndex(){

	var checkDropF = new Query("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='USR_Filters'");

	var checkDropFResult = checkDropF.ExecuteScalar();

	if (checkDropFResult == 1) {

		var dropF = new Query("DELETE FROM USR_Filters");

		dropF.Execute();

	} else {

		var createTable = new Query("CREATE TABLE IF NOT EXISTS USR_Filters(Id Text, FilterType Text); " +
																"CREATE INDEX IF NOT EXISTS IND_FILTERS ON USR_Filters(FilterType)");

		createTable.Execute();

	}

}

function AlternativeStep(nextStep){
	var action;
	action = GetAction(nextStep);

	if (action != null) {
		Workflow.Action(action, []);
		return false;
	}
	return true;
}

function CloseCreatedOutlet(){
	Workflow.Action("Select", []);
	GlobalWorkflow.SetOutletIsCreated(false);
	return false;
}

function NextDoc(lastStep, nextStep){
	next = false;

	if ((lastStep=="SKUs" && nextStep=="Order") || (nextStep=="SKUs" && lastStep=="Order"))
		next = true;
	if ((lastStep=="Order" && nextStep=="Return") || (nextStep=="Order" && lastStep=="Return"))
		next = true;

	return next;
}

function WriteScreenName(stepName){
	if (stepName=="Order" || stepName=="Return" || stepName=="SKUs"){
		if ($.workflow.HasValue("currentDoc"))
			$.workflow.Remove("currentDoc");
		$.workflow.Add("currentDoc", stepName);
	}

	if (stepName=="OrderList" || stepName=="ReturnList"){
		if ($.workflow.HasValue("step"))
			$.workflow.Remove("step");
		$.workflow.Add("step", stepName);
	}
}

function SetSteps(outlet) {

	var q = new Query("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='USR_WorkflowSteps'");
	var check = q.ExecuteScalar();

	if (parseInt(check) == parseInt(1)) {
		var dropQS = new Query("DELETE FROM USR_WorkflowSteps");
		dropQS.Execute();
	} else {
		var q = new Query("CREATE TABLE " + " USR_WorkflowSteps (StepOrder, Skip, Value, NextStep, LastStep)");
		q.Execute();
	}

	var skipQuest = false;

	var hasContractors = HasContractors(outlet);

	var q = new Query("SELECT CreateOrderInMA, FillQuestionnaireInMA, DoEncashmentInMA, CreateReturnInMA FROM Catalog_OutletsStatusesSettings WHERE Status=@status");
	q.AddParameter("status", outlet.OutletStatus);
	var statusValues = q.Execute();
	while (statusValues.Next()) {
		if (EvaluateBoolean(statusValues.CreateOrderInMA) && $.sessionConst.orderEnabled && hasContractors)
			InsertIntoSteps("4", "SkipOrder", false, "Order", "SKUs");
		else
			InsertIntoSteps("4", "SkipOrder", true, "Order", "SKUs");
		if (EvaluateBoolean(statusValues.CreateReturnInMA) && $.sessionConst.returnEnabled && hasContractors) {
			InsertIntoSteps("5", "SkipReturn", false, "Return", "Order");
		}
		else
			InsertIntoSteps("5", "SkipReturn", true, "Return", "Order");
		if (EvaluateBoolean(statusValues.DoEncashmentInMA) && $.sessionConst.encashEnabled)
			InsertIntoSteps("6", "SkipEncashment", false, "Receivables", "Return");
		else
			InsertIntoSteps("6", "SkipEncashment", true, "Receivables", "Return");
		if (EvaluateBoolean(statusValues.FillQuestionnaireInMA))
			skipQuest = false;
		else
			skipQuest = true;
	}

	if (parseInt(GetTasksCount(outlet)) != parseInt(0))
		InsertIntoSteps("1", "SkipTask", false, "Visit_Tasks", "Outlet");
	else
		InsertIntoSteps("1", "SkipTask", true, "Visit_Tasks", "Outlet");

	if (parseInt(GetQuestionsCount()) == parseInt(0) || skipQuest)
		InsertIntoSteps("2", "SkipQuestions", true, "Questions", "Visit_Tasks");
	else
		InsertIntoSteps("2", "SkipQuestions", false, "Questions", "Visit_Tasks");

	if (parseInt(GetSKUQuestionsCount()) == parseInt(0) || skipQuest)
		InsertIntoSteps("3", "SkipSKUs", true, "SKUs", "Questions");
	else
		InsertIntoSteps("3", "SkipSKUs", false, "SKUs", "Questions");

}

function InsertIntoSteps(stepOrder, skip, value, action, previousStep) {
	var q = new Query("INSERT INTO USR_WorkflowSteps VALUES (@stepOrder, @skip, @value, @action, @previousStep)");
	q.AddParameter("stepOrder", stepOrder);
	q.AddParameter("skip", skip);
	q.AddParameter("value", value);
	q.AddParameter("action", action);
	q.AddParameter("previousStep", previousStep);
	q.Execute();
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

function GetAction(nextStep) {
	var q = new Query("SELECT Skip FROM USR_WorkflowSteps WHERE NextStep=@nextStep AND Value=1 ORDER BY StepOrder LIMIT 1");
	q.AddParameter("nextStep", nextStep);
	return q.ExecuteScalar();
}

function EvaluateBoolean(res){
	if (res == null)
		return false;
	else {
		if (parseInt(res) == parseInt(0))
			return false
		else
			return true;
	}
}

function PrepareScheduledVisits_Map() {
	var visitPlans = Variables["visitPlans"];
	for ( var visitPlan in visitPlans) {
		var outlet = DB.Current.Catalog.Outlet.SelectBy("Id", visitPlan)
				.First();
		if (!isDefault(outlet.Lattitude) && !isDefault(outlet.Longitude)) {
			var query = new Query();
			query.AddParameter("Date", DateTime.Now.Date);
			query.AddParameter("Outlet", outlet.Id);
			query.Text = "select single(*) from Document.Visit where Date.Date == @Date && Outlet==@Outlet";
			var result = query.Execute();
			if (result == null)
				Variables["map"].AddMarker(outlet.Description,
						outlet.Lattitude, outlet.Longitude, "yellow");
			else
				Variables["map"].AddMarker(outlet.Description,
						outlet.Lattitude, outlet.Longitude, "green");
		}
	}
}

function GetTasksCount(outlet) {
	// var taskQuery = new Query("SELECT COUNT(Id) FROM Document_Task " +
	// 	"WHERE (Status=0 AND DATE(StartPlanDate)<=DATE('now', 'localtime')) " +
	// 	" OR " +
	// 	" (Status=1 AND DATE(ExecutionDate)=DATE('now', 'localtime')) " +
	// 	" AND Outlet=@outlet");
	// taskQuery.AddParameter("outlet", outlet);
	// return taskQuery.ExecuteScalar();
	return parseInt(1);

}


//-----Questionnaire selection-------

function GetRegionQueryText1() {

	var loop = 1;

	var startSelect = " UNION SELECT 'Catalog_Region', NULL, '@ref[Catalog_OutletParameter]:00000000-0000-0000-0000-000000000000', replace(R" + loop + ".Id, ('@ref[Catalog_Region]:'), '') " +
			"FROM Catalog_Territory T " +
			"JOIN Catalog_Territory_Outlets O ON T.Id=O.Ref AND O.Outlet=@outlet JOIN Catalog_Region R1 ON T.Owner=R1.Id ";
	var recJoin = "";

	var text = startSelect;

	loop = 2;

	while (loop < 11) {
		recJoin = recJoin + " JOIN Catalog_Region " + "R" + loop + " ON R" + (parseInt(loop) - parseInt(1)) + ".Parent=R" + loop + ".Id " ;
		text = text + "UNION " + "SELECT 'Catalog_Region', NULL, '@ref[Catalog_OutletParameter]:00000000-0000-0000-0000-000000000000', REPLACE(R" + loop + ".Id, ('@ref[Catalog_Region]:'), '') " +
				"FROM Catalog_Territory T " +
		"JOIN Catalog_Territory_Outlets O ON T.Id=O.Ref AND O.Outlet=@outlet JOIN Catalog_Region R1 ON T.Owner=R1.Id " + recJoin;
		loop = loop + 1;
	}

	return text;
}

function CreateQuestionnareTable(outlet) {

	var q = new Query("SELECT count(*) FROM sqlite_master WHERE type='table' AND name=@name");
	q.AddParameter("name", "USR_OutletAttributes");

	var check = q.ExecuteScalar();

	if (parseInt(check) == parseInt(1)) {
		var tableCommand = "DELETE FROM USR_OutletAttributes; ";
	}	else {
		var tableCommand = "CREATE TABLE USR_OutletAttributes (Selector, DataType, AdditionalParameter, Value); ";
	}

	var OutletAttributesText = tableCommand + "INSERT INTO USR_OutletAttributes " +
										"SELECT 'Enum_OutletStatus' AS Selector, NULL AS DataType, '@ref[Catalog_OutletParameter]:00000000-0000-0000-0000-000000000000' AS AdditionalParameter, REPLACE(@outletStatus, ('@ref[Enum_OutletStatus]:'), '') AS Value " +
							"UNION SELECT 'Catalog_OutletType', NULL, '@ref[Catalog_OutletParameter]:00000000-0000-0000-0000-000000000000', REPLACE(@outletType, ('@ref[Catalog_OutletType]:'), '') " +
							"UNION SELECT 'Catalog_OutletClass', NULL, '@ref[Catalog_OutletParameter]:00000000-0000-0000-0000-000000000000', REPLACE(@outletClass, ('@ref[Catalog_OutletClass]:'), '') " +
							"UNION SELECT 'Catalog_Distributor', NULL, '@ref[Catalog_OutletParameter]:00000000-0000-0000-0000-000000000000', REPLACE(@distributor, ('@ref[Catalog_Distributor]:'), '') " +
							"UNION SELECT 'Catalog_Positions', NULL, '@ref[Catalog_OutletParameter]:00000000-0000-0000-0000-000000000000', REPLACE((SELECT Position FROM Catalog_User LIMIT 1), ('@ref[Catalog_Positions]:'), '') " +
							"UNION SELECT 'Catalog_Outlet', NULL, '@ref[Catalog_OutletParameter]:00000000-0000-0000-0000-000000000000', REPLACE(@outlet, ('@ref[Catalog_Outlet]:'), '') " +
							"UNION SELECT 'Catalog_OutletParameter', COP.DataType, OP.Parameter, OP.Value FROM Catalog_Outlet_Parameters OP LEFT JOIN Catalog_OutletParameter COP ON OP.Parameter=COP.Id WHERE Ref=@outlet " +
							"UNION SELECT 'Catalog_Territory', NULL, '@ref[Catalog_OutletParameter]:00000000-0000-0000-0000-000000000000', REPLACE(Ref, ('@ref[Catalog_Territory]:'), '') FROM Catalog_Territory_Outlets WHERE Outlet=@outlet " +
							 GetRegionQueryText1() + "; ";

	var tableCommand = Global.CreateUserTableIfNotExists("USR_SelectedQuestionnaires");

	var SelectedQuestionnairesText = tableCommand +
			"SELECT DISTINCT Q.Id AS Id" + //all the parameters that compare with 'AND'
			", CASE " +
			"WHEN S.ComparisonType IS NULL " +
			"THEN 1 " +

			"WHEN O.Selector IS NULL AND (S.ComparisonType=@equal OR S.ComparisonType=@inList) " +
			"THEN 0 " +
			"WHEN O.Selector IS NULL AND S.ComparisonType=@notEqual " +
			"THEN 1 " +

			"WHEN S.ComparisonType=@equal " +
			"THEN CASE WHEN O.DataType = @decimal THEN REPLACE(S.Value, ',', '.') = REPLACE(O.Value, ',', '.') ELSE S.Value = O.Value END " +
			"WHEN S.ComparisonType=@inList " +
			"THEN CASE WHEN O.DataType = @decimal THEN REPLACE(O.Value, ',', '.') IN (SELECT REPLACE(Value, ',', '.') FROM Document_Questionnaire_Selectors WHERE Ref=Q.Id) ELSE O.Value IN (SELECT Value FROM Document_Questionnaire_Selectors WHERE Ref=Q.Id) END " +
			"WHEN S.ComparisonType=@notEqual " +
			"THEN CASE WHEN O.DataType = @decimal THEN REPLACE(S.Value, ',', '.') != REPLACE(O.Value, ',', '.') ELSE S.Value != O.Value END " +

			"END AS Selected " +

			"FROM Document_Questionnaire Q " +
			"LEFT JOIN Document_Questionnaire_Selectors S ON S.Ref=Q.Id " +
			"LEFT JOIN USR_OutletAttributes O ON S.Selector=O.Selector AND S.AdditionalParameter=O.AdditionalParameter " +
			"WHERE S.Selector IS NULL OR (S.Selector != 'Catalog_Territory' AND S.Selector != 'Catalog_Region') " +

			"UNION " +  //'Catalog_Territory' select
			"SELECT DISTINCT S.Ref AS Id, 1 " +
			"FROM USR_OutletAttributes O " +
			"JOIN Document_Questionnaire_Selectors S ON O.Selector=S.Selector " +
			"AND S.Selector = 'Catalog_Territory' " +

			"AND CASE WHEN S.ComparisonType=@equal OR S.ComparisonType=@inList " +
			"THEN S.Value = O.Value " +
			"WHEN S.ComparisonType=@notEqual " +
			"THEN S.Value != O.Value " +
			"END " +

			"UNION " + //'Catalog_Region' select
			"SELECT DISTINCT S.Ref AS Id, 1 " +
			"FROM USR_OutletAttributes O " +
			"JOIN Document_Questionnaire_Selectors S ON O.Selector=S.Selector " +
			"AND S.Selector = 'Catalog_Region' " +

			"AND CASE WHEN S.ComparisonType=@equal OR S.ComparisonType=@inList " +
			"THEN S.Value = O.Value " +
			"WHEN S.ComparisonType=@notEqual " +
			"THEN S.Value NOT IN (SELECT Value FROM USR_OutletAttributes WHERE Selector='Catalog_Region') " +
			"END; ";

	var tableCommand = Global.CreateUserTableIfNotExists("USR_Questionnaires");

	var QuestionnairesText = tableCommand +
			"SELECT DISTINCT Q.Id AS Id, Q.Number AS Number, Q.Date AS Date, Q.Single AS Single " +
				", S.BeginAnswerPeriod AS BeginAnswerPeriod, S.EndAnswerPeriod AS EndAnswerPeriod, MIN(CAST (SQ.Selected AS INT)) AS Selected " +
			"FROM " +
			"USR_SelectedQuestionnaires SQ " +
			"JOIN Document_Questionnaire Q ON SQ.Id=Q.Id " +
			"JOIN _Document_Questionnaire_Schedule S INDEXED BY IND_QSCHEDULE ON SQ.Id=S.Ref AND S.IsTombstone=0 " +
			"WHERE Q.Status=@active AND date(S.Date)=date('now', 'start of day') " +
			"GROUP BY Q.Id, Q.Number, Q.Date, Q.Single, S.BeginAnswerPeriod, S.EndAnswerPeriod; " +
			"DELETE FROM USR_Questionnaires WHERE Selected=0";

	var query = new Query(OutletAttributesText + SelectedQuestionnairesText + QuestionnairesText);

	query.AddParameter("outletStatus", outlet.OutletStatus);
	query.AddParameter("outletType", outlet.Type);
	query.AddParameter("outletClass", outlet.Class);
	query.AddParameter("distributor", outlet.Distributor);
	query.AddParameter("outlet", outlet);
	query.AddParameter("equal", DB.Current.Constant.ComparisonType.Equal);
	query.AddParameter("inList", DB.Current.Constant.ComparisonType.InList);
	query.AddParameter("notEqual", DB.Current.Constant.ComparisonType.NotEqual);
	query.AddParameter("decimal", DB.Current.Constant.DataType.Decimal);
	query.AddParameter("active", DB.Current.Constant.QuestionnareStatus.Active);
	query.Execute();

}

function CreateQuestionsTable(outlet) {

	var tableCommand = Global.CreateUserTableIfNotExists("USR_Questions");

	var query = new Query(tableCommand +
		"SELECT " +
			"D.Date AS DocDate, " +
			"Q.ChildQuestion AS Question, " +
			"Q.ChildDescription AS Description, " +
			"Q.ChildType AS AnswerType, " +
			"Q.ParentQuestion AS ParentQuestion, " +
			"Q.QuestionOrder AS QuestionOrder, " +
			"CASE WHEN Q.ChildType = @integer OR Q.ChildType = @decimal OR Q.ChildType = @string THEN 1 ELSE NULL END AS IsInputField, " +
			"CASE WHEN Q.ChildType = @integer OR Q.ChildType = @decimal THEN 'numeric' ELSE 'auto' END AS KeyboardType, " +
			"D.Single AS Single, " +
			"MAX(CAST(Q.Obligatoriness AS int)) AS Obligatoriness, " +
			"A.Answer AS Answer, " +
			"A.Answer AS HistoryAnswer, " +
			"A.AnswerDate AS AnswerDate " +

		"FROM _Document_Questionnaire_Questions Q INDEXED BY IND_QSKUQ " +
		"JOIN USR_Questionnaires D ON Q.Ref=D.Id " +
		"LEFT JOIN _Catalog_Outlet_AnsweredQuestions A INDEXED BY IND_AQ ON A.IsTombstone = 0 AND A.Ref = @outlet AND A.Questionaire = D.Id " +
																						"AND A.Question = Q.ChildQuestion AND IFNULL(A.SKU, @emptySKU) = @emptySKU " +
																						"AND DATE(A.AnswerDate) >= DATE(D.BeginAnswerPeriod) " +
																						"AND (DATE(A.AnswerDate) <= DATE(D.EndAnswerPeriod) OR A.AnswerDate = '0001-01-01 00:00:00') " +
		"WHERE Q.IsTombstone = 0 " +
		"GROUP BY Q.ChildQuestion, " +
			"D.Date, " +
			"Q.ParentQuestion, " +
			"Q.ChildDescription, " +
			"Q.ChildType, " +
			"D.Single, " +
			"A.Answer, " +
			"A.AnswerDate, " +
			"CASE WHEN Q.ChildType = @integer OR Q.ChildType = @decimal OR Q.ChildType = @string THEN 1 ELSE NULL END, " +
			"CASE WHEN Q.ChildType = @integer OR Q.ChildType = @decimal THEN 'numeric' ELSE 'auto' END; " +
			"CREATE INDEX IF NOT EXISTS IND_Q ON USR_Questions(ParentQuestion)");

	query.AddParameter("emptySKU", DB.EmptyRef("Catalog_SKU"));
	query.AddParameter("integer", DB.Current.Constant.DataType.Integer);
	query.AddParameter("decimal", DB.Current.Constant.DataType.Decimal);
	query.AddParameter("string", DB.Current.Constant.DataType.String);
	query.AddParameter("outlet", outlet);
	query.Execute();

}

function CreateSKUQuestionsTable(outlet) {

	var tableCommand = Global.CreateUserTableIfNotExists("USR_SKUQuestions");

	var query = new Query(tableCommand +
		"SELECT " +
			"D.Date AS DocDate, " +
			"S.SKU AS SKU, " +
			"S.Description AS SKUDescription, " +
			"Q.ChildQuestion AS Question, " +
			"Q.ChildDescription AS Description, " +
			"Q.ChildType AS AnswerType, " +
			"Q.ParentQuestion AS ParentQuestion, " +
			"Q.QuestionOrder AS QuestionOrder, " +
			"CASE WHEN Q.ChildType = @integer OR Q.ChildType = @decimal OR Q.ChildType = @string THEN 1 ELSE NULL END AS IsInputField, " +
			"CASE WHEN Q.ChildType = @integer OR Q.ChildType = @decimal THEN 'numeric' ELSE 'auto' END AS KeyboardType, " +
			"D.Single AS Single, " +
			"MAX(CAST (Q.Obligatoriness AS int)) AS Obligatoriness, " +
			"SK.Owner AS OwnerGroup, " +
			"SK.Brand AS Brand, " +
			"A.Answer AS Answer, " +
			"A.Answer AS HistoryAnswer, " +
			"A.AnswerDate AS AnswerDate " +

		"FROM _Document_Questionnaire_SKUQuestions Q INDEXED BY IND_QSKUSQ " +
		"JOIN _Document_Questionnaire_SKUs S INDEXED BY IND_QSKU ON S.IsTombstone = 0 AND Q.Ref=S.Ref " +
		"JOIN USR_Questionnaires D ON Q.Ref=D.Id " +
		"JOIN Catalog_SKU SK ON SK.Id=S.SKU " +
		"LEFT JOIN _Catalog_Outlet_AnsweredQuestions A INDEXED BY IND_AQ ON A.IsTombstone = 0 AND A.Ref = @outlet AND A.Questionaire = D.Id " +
																"AND A.Question = Q.ChildQuestion AND A.SKU = S.SKU " +
																"AND DATE(A.AnswerDate) >= DATE(D.BeginAnswerPeriod) " +
																"AND (DATE(A.AnswerDate) <= DATE(D.EndAnswerPeriod) OR A.AnswerDate = '0001-01-01 00:00:00') " +

    "WHERE Q.IsTombstone = 0 " +
		"GROUP BY Q.ChildQuestion, " +
			"Q.ChildDescription, " +
			"Q.ChildType, " +
			"Q.ParentQuestion, " +
			"Q.QuestionOrder, " +
			"D.Single, " +
			"S.SKU, " +
			"S.Description, " +
			"SK.Owner, " +
			"SK.Brand, " +
			"A.Answer, " +
			"A.AnswerDate, " +
			"CASE WHEN Q.ChildType = @integer OR Q.ChildType = @decimal OR Q.ChildType = @string THEN 1 ELSE NULL END, " +
			"CASE WHEN Q.ChildType = @integer OR Q.ChildType = @decimal THEN 'numeric' ELSE 'auto' END; " +
			"CREATE INDEX IF NOT EXISTS IND_SQ ON USR_SKUQuestions(SKU, ParentQuestion); ");

	query.AddParameter("integer", DB.Current.Constant.DataType.Integer);
	query.AddParameter("decimal", DB.Current.Constant.DataType.Decimal);
	query.AddParameter("string", DB.Current.Constant.DataType.String);
	query.AddParameter("outlet", outlet);
	query.Execute();

}

function ListSelectorIsChanged(currentSelector, selector, additionalParam, currentParam) {
	if (selector=="Catalog_OutletParameter"){
		if (currentSelector!=null && currentParam!=additionalParam)
			return true;
		else
			return false;
	}
	else{
		if (currentSelector!=null && currentSelector!=selector)
			return true;
		else
			return false;
	}
}

function CheckListSelector(list) {
	for (var item in list) {
		if (item){
			return true;
		}
	}
	return false;
}

function GetRegionQueryText() {
	var startSelect = "SELECT R1.Id, R1.Description FROM Catalog_Region R1 ";
	var condition = "JOIN Catalog_Territory T ON T.Owner = R1.Id " +
			"JOIN Catalog_Territory_Outlets O ON O.Ref = T.Id AND O.Outlet = @outlet ";
	var recJoin = "";

	var text = startSelect + condition + "WHERE R1.Id=@region ";

	var loop = 2;

	while (loop < 11) {
		recJoin = recJoin + "JOIN Catalog_Region " + "R" + loop + " ON R" + loop + ".Id=R" + (loop-1) + ".Parent ";
		text = text + "UNION ALL " + startSelect + recJoin + condition + "WHERE R" + loop + ".Id=@region ";
		loop = loop + 1;
	}

	return text;
}


//-----Questions count-----------

function GetQuestionsCount() {
	var query = new Query("SELECT COUNT(Question) FROM USR_Questions LIMIT 1");
	var res = query.ExecuteScalar();
	return res;
}

function GetSKUQuestionsCount() {
	var query = new Query("SELECT COUNT(SKU) FROM USR_SKUQuestions LIMIT 1");
	var res = query.ExecuteScalar();
	return res;
}

function CreateCondition(list) {
	var str = "";
	var notEmpty = false;

	for ( var quest in questionnaires) {
		if (String.IsNullOrEmpty(str)==false){
			str = str + ", ";
		}
		str = str + " '" + quest.ToString() + "' ";
		notEmpty = true;
	}
	if (notEmpty){
		str = " WHERE Ref IN ( " + str  + ") ";
	}

	return str;
}

function DeleteFromList(item, collection) {
    var list = new List;
    for (var i in collection) {
        if (item.ToString() != i.ToString())
            list.Add(i);
    }
    return list;
}

function ClearUSRTables(){
	var q = new Query("DELETE FROM USR_Questionnaires");
	q.Execute();

	var q = new Query("DELETE FROM USR_Questions");
	q.Execute();
	
	var q = new Query("DELETE FROM USR_SKUQuestions");
	q.Execute();
}