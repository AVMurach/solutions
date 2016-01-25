// ------------------------ Application -------------------

function OnApplicationInit() {
	SetSessionConstants();
	Indicators.SetIndicators();
}

// ------------------------ Events ------------------------

function OnLoad(screenName) {
	if (screenName == "Outlet_Map.xml") {
		var outlet = Variables["outlet"];
		Variables["map"].AddMarker(outlet.Description, outlet.Lattitude,
				outlet.Longitude, "red");
	} else if (screenName == "ScheduledVisits_Map.xml") {
		PrepareScheduledVisits_Map();
	}
}

function OnWorkflowStart(name) {
	if ($.Exists("workflow"))
		$.Remove("workflow");
	Variables.AddGlobal("workflow", new Dictionary());
	if (name == "Visits" || name == "Outlets" || name=="CreateOrder") {
		GPS.StartTracking();
	}

	if (name == "Visit") {
		
			var questionnaires = GetQuestionnairesForOutlet($.outlet);
			$.workflow.Add("questionnaires", questionnaires);
			
			CreateQuestionnareTable($.outlet);
			CreateQuestionsTable($.outlet);

			if (parseInt(GetTasksCount()) != parseInt(0))
				$.workflow.Add("skipTasks", false); // нельзя просто взять и присвоить значение переменной!
			else
				$.workflow.Add("skipTasks", true);

			if (parseInt(GetQuestionsCount(questionnaires)) != parseInt(0))
				$.workflow.Add("skipQuestions", false);
			else
				$.workflow.Add("skipQuestions", true);

			if (parseInt(GetSKUQuestionsCount(questionnaires)) != parseInt(0)) 
				$.workflow.Add("skipSKUs", false);
			else
				$.workflow.Add("skipSKUs", true);
	}
	
	Variables["workflow"].Add("name", name);

	if (name=="Visit" || name=="CreateOrder" || name=="Order"){
		
		var checkDropF = new Query("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='USR_Filters'");
		
		var checkDropFResult = checkDropF.ExecuteScalar();
		
		if (checkDropFResult == 1) {
		
			var dropF = new Query("DELETE FROM USR_Filters");
			 
			dropF.Execute();
			
		} else {
			
			var createTable = new Query("CREATE TABLE IF NOT EXISTS USR_Filters(Id Text, FilterType Text)");
			 
			createTable.Execute();
			
		}
								
	}
	
}

function OnWorkflowForward(name, lastStep, nextStep, parameters) {
//	if (lastStep == "Order" && nextStep == "EditSKU" && Variables.Exists("AlreadyAdded") == false) {
//		Variables.AddGlobal("AlreadyAdded", true);
//	}
}

function OnWorkflowForwarding(workflowName, lastStep, nextStep, parameters) {

	if (workflowName == "Visit") {

		if (nextStep == "Visit_Tasks") {
			if ($.workflow.skipTasks) {
				if ($.workflow.skipQuestions) {
					if ($.workflow.skipSKUs) {
						Workflow.Action("Skip3", [ outlet ]);
						return false;
					}
					Workflow.Action("Skip2", []);
					return false;
				}
				Workflow.Action("Skip1", []);
				return false;
			}
		}

		if (nextStep == "Questions") {
			if ($.workflow.skipQuestions) {
				if ($.workflow.skipSKUs) {
					Workflow.Action("Skip3", [ outlet ]);
					return false;
				}
				Workflow.Action("Skip2", []);
				return false;
			} else
				Workflow.Action("Skip1", []);
		}

		if (nextStep == "SKUs") {
			if ($.workflow.skipSKUs) {
				Workflow.Action("Skip3", [ outlet ]);
				return false;
			} else
				Workflow.Action("Skip2", []);
		}
	}

	return true;
			
}

//function OnWorkflowBack(name, lastStep, nextStep) {}

function OnWorkflowFinish(name, reason) {
	$.Remove("finishedWorkflow");
	$.AddGlobal("finishedWorkflow", name);
	
	if (name == "Visit" || name == "CreateOrder" || name=="Outlets") {
		Variables.Remove("outlet");

		if (Variables.Exists("planVisit"))
			Variables.Remove("planVisit");
		if (Variables.Exists("steps"))
			Variables.Remove("steps");

		GPS.StopTracking();
		
		Indicators.SetIndicators();
	}

	Variables.Remove("workflow");
	
	if (name=="Visit" || name=="CreateOrder"){
		
		var checkDropF = new Query("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='USR_Filters'");
		
		var checkDropFResult = checkDropF.ExecuteScalar();
		
		if (checkDropFResult == 1) {
		
			var dropF = new Query("DELETE FROM USR_Filters");
			 
			dropF.Execute();
			
		}
										
	}
}

function OnWorkflowPause(name) {
	Variables.Remove("workflow");
}

// ------------------------ Functions ------------------------

function SetSessionConstants() { 
	var planEnbl = new Query("SELECT Use FROM Catalog_MobileApplicationSettings WHERE Code='PlanEnbl'");
	var multStck = new Query("SELECT Use FROM Catalog_MobileApplicationSettings WHERE Code='MultStck'");
	var stckEnbl = new Query("SELECT Use FROM Catalog_MobileApplicationSettings WHERE Code='NoStkEnbl'");
	var orderCalc = new Query("SELECT Use FROM Catalog_MobileApplicationSettings WHERE Code='OrderCalc'");
	
	$.AddGlobal("sessionConst", new Dictionary());
	$.sessionConst.Add("PlanEnbl", EvaluateBoolean(planEnbl.ExecuteScalar()));
	$.sessionConst.Add("MultStck", EvaluateBoolean(multStck.ExecuteScalar()));
	$.sessionConst.Add("NoStkEnbl", EvaluateBoolean(stckEnbl.ExecuteScalar()));
	$.sessionConst.Add("OrderCalc", EvaluateBoolean(orderCalc.ExecuteScalar()));
	
	var q = new Query("SELECT U.AccessRight, A.Id, A.Code FROM Catalog_MobileAppAccessRights A " +
			" LEFT JOIN Catalog_User_UserRights U ON U.AccessRight=A.Id ");
	var rights = q.Execute();
	while (rights.Next()) {
		if (rights.Code=='000000002'){
			if (rights.AccessRight==null)
				$.sessionConst.Add("editOutletParameters", false);
			else
				$.sessionConst.Add("editOutletParameters", true);
		}
		if (rights.Code=='000000003'){
			if (rights.AccessRight==null)
				$.sessionConst.Add("galleryChoose", false);
			else
				$.sessionConst.Add("galleryChoose", true);
		}			
		if (rights.Code=='000000004'){
			if (rights.AccessRight==null)
				$.sessionConst.Add("encashEnabled", false);
			else
				$.sessionConst.Add("encashEnabled", true);
		}
	}				
	
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

function GetTasksCount() {
	var taskQuery = new Query("SELECT COUNT(Id) FROM Document_Task WHERE PlanDate >= date('now','start of day') AND Outlet=@outlet");
	taskQuery.AddParameter("outlet", $.outlet);
	return taskQuery.ExecuteScalar();
}


//-----Questionnaire selection-------

function GetQuestionnairesForOutlet(outlet) {
	var query = new Query("SELECT DISTINCT Q.Id " +
			"FROM Document_Questionnaire_Schedule S " +
			"JOIN Document_Questionnaire Q ON Q.Id=S.Ref " +
			"WHERE date(S.Date)=date('now', 'start of day') AND Q.Status=@active ORDER BY Q.Id");
	query.AddParameter("active", DB.Current.Constant.QuestionnareStatus.Active);
	var recordset = query.Execute();

	var list = new List;
	var actualQuestionnaire = true;
	var currentQuestionnaire;
	
	while (recordset.Next()) {		
		
		var query1 = new Query("SELECT Selector, ComparisonType, Value, AdditionalParameter, Ref " +
				"FROM Document_Questionnaire_Selectors WHERE Ref=@ref ORDER BY Selector, ComparisonType");
		query1.AddParameter("ref",recordset.Id);
		var selectors = query1.Execute();
		
		var listParameter = new List;	//
		var listChecked = true;			//stuff for
		var currentSelector=null;		//list selector
		var currentParam = null;				//
		
		while (selectors.Next() && actualQuestionnaire) {				
				
			if (ListSelectorIsChanged(currentSelector, selectors.Selector, selectors.AdditionalParameter, currentParam)){ //it's time to check list selector
				actualQuestionnaire = CheckListSelector(listParameter);
				if (actualQuestionnaire==false){
					break;
				}
				listParameter = new List;
				listChecked = true;
			}
			
			//if (selectors.ComparisonType=="In list" || selectors.ComparisonType=="В списке"){								
			if ((selectors.ComparisonType).ToString()==(DB.Current.Constant.ComparisonType.InList).ToString()){
				listParameter.Add(CheckSelector(outlet, selectors.Selector, DB.Current.Constant.ComparisonType.Equal, selectors.Value, selectors.AdditionalParameter)); //real check is later, now - only an array
				listChecked = false;
				currentSelector = selectors.Selector;			//stuff for
				currentParam = selectors.AdditionalParameter;	//list selectors, again
			}
			else{
				actualQuestionnaire = CheckSelector(outlet, selectors.Selector, selectors.ComparisonType, selectors.Value, selectors.AdditionalParameter);
				currentSelector = null;
				currentParam = null;
			}						
			
		}
		
		if (listChecked==false){ //one more time try to check list if it's hasn't been done in loop
			actualQuestionnaire = CheckListSelector(listParameter);
		}
		
		if (actualQuestionnaire) //this is what it's all for
			list.Add(recordset.Id);
		
		actualQuestionnaire = true;
	}
	
	return list;
			
}

function CreateQuestionnareTable(outlet) {
	
	var checkQS = new Query("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='USR_Questionnaires'");
	
	var checkQSResult = checkQS.ExecuteScalar();
	
	if (checkQSResult == parseInt(1)) {
	
		var dropQS = new Query("DELETE FROM USR_Questionnaires");
		 
		dropQS.Execute();
		
		var headerText = "INSERT INTO USR_Questionnaires ";
				
	} else {
		
		var headerText = "CREATE TABLE USR_Questionnaires AS ";
		
	}
	
	var query = new Query(headerText +
			"SELECT DISTINCT Q.Id AS Id, Q.Number AS Number, Q.Date AS Date, Q.Single AS Single " +
				", S.BeginAnswerPeriod AS BeginAnswerPeriod, S.EndAnswerPeriod AS EndAnswerPeriod " +
			"FROM Document_Questionnaire_Schedule S " +
			"JOIN Document_Questionnaire Q ON Q.Id=S.Ref " +
			"WHERE date(S.Date)=date('now', 'start of day') AND Q.Status=@active ORDER BY Q.Id");
	query.AddParameter("active", DB.Current.Constant.QuestionnareStatus.Active);
	query.Execute();

	var queryQ = new Query("SELECT Id FROM USR_Questionnaires");
	var recordset = queryQ.Execute();
		
	var actualQuestionnaire = true;
	var currentQuestionnaire;
	
	while (recordset.Next()) {		
		
		var query1 = new Query("SELECT Selector, ComparisonType, Value, AdditionalParameter, Ref " +
				"FROM Document_Questionnaire_Selectors WHERE Ref=@ref ORDER BY Selector, ComparisonType");
		query1.AddParameter("ref",recordset.Id);
		var selectors = query1.Execute();
		
		var listParameter = new List;	//
		var listChecked = true;			//stuff for
		var currentSelector=null;		//list selector
		var currentParam = null;				//
		
		while (selectors.Next() && actualQuestionnaire) {				
				
			if (ListSelectorIsChanged(currentSelector, selectors.Selector, selectors.AdditionalParameter, currentParam)){ //it's time to check list selector
				actualQuestionnaire = CheckListSelector(listParameter);
				if (actualQuestionnaire==false){
					break;
				}
				listParameter = new List;
				listChecked = true;
			}
			
			//if (selectors.ComparisonType=="In list" || selectors.ComparisonType=="В списке"){								
			if ((selectors.ComparisonType).ToString()==(DB.Current.Constant.ComparisonType.InList).ToString()){
				listParameter.Add(CheckSelector(outlet, selectors.Selector, DB.Current.Constant.ComparisonType.Equal, selectors.Value, selectors.AdditionalParameter)); //real check is later, now - only an array
				listChecked = false;
				currentSelector = selectors.Selector;			//stuff for
				currentParam = selectors.AdditionalParameter;	//list selectors, again
			}
			else{
				actualQuestionnaire = CheckSelector(outlet, selectors.Selector, selectors.ComparisonType, selectors.Value, selectors.AdditionalParameter);
				currentSelector = null;
				currentParam = null;
			}						
			
		}
		
		if (listChecked==false){ //one more time try to check list if it's hasn't been done in loop
			actualQuestionnaire = CheckListSelector(listParameter);
		}
		
		if (actualQuestionnaire==false){ //this is what it's all for
			var qDelete = new Query("DELETE FROM USR_Questionnaires WHERE Id=@id");
			qDelete.AddParameter("id", recordset.Id);
			qDelete.Execute();			
		}
		
		actualQuestionnaire = true;
	}

}

function CreateQuestionsTable(outlet) {
	
	var checkQ = new Query("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='USR_Questions'");
	
	var checkQResult = checkQ.ExecuteScalar();
	
	if (checkQResult == parseInt(1)) {
	
		var dropQ = new Query("DELETE FROM USR_Questions");
		 
		dropQ.Execute();
		
		var headerText = "INSERT INTO USR_Questions ";
				
	} else {
		
		var headerText = "CREATE TABLE USR_Questions AS ";
		
	}
	
	var query = new Query(headerText +
			"SELECT MIN(D.Date) AS DocDate, Q.ChildQuestion AS Question, Q.ChildDescription AS Description" +
			", Q.ParentQuestion AS ParentQuestion, Q.ChildType AS AnswerType" +
			", A.Answer AS Answer, MAX(A.AnswerDate) AS AnswerDate, D.Single AS Single " +
			", MAX(CAST (Q.Obligatoriness AS int)) AS Obligatoriness" +
			", (SELECT Qq.QuestionOrder FROM Document_Questionnaire Dd  " +
			" JOIN Document_Questionnaire_Questions Qq ON Dd.Id=Qq.Ref AND Q.ChildQuestion=Qq.ChildQuestion AND Dd.Id=D.Id ORDER BY Dd.Date LIMIT 1) AS QuestionOrder" + //QuestionOrder
			
			", CASE WHEN Q.ChildType=@integer OR Q.ChildType=@decimal OR Q.ChildType=@string THEN 1 ELSE NULL END AS IsInputField " + //IsInputField
			", CASE WHEN Q.ChildType=@integer OR Q.ChildType=@decimal THEN 'numeric' ELSE 'auto' END AS KeyboardType " + //KeyboardType
			
			"FROM Document_Questionnaire_Questions Q " +
			"JOIN USR_Questionnaires D ON Q.Ref=D.Id " +
			"LEFT JOIN Catalog_Outlet_AnsweredQuestions A ON A.Ref = @outlet AND A.Questionaire=D.Id " +
				"AND A.Question=Q.ChildQuestion AND (A.SKU=@emptySKU OR A.SKU IS NULL) AND DATE(A.AnswerDate)>=DATE(D.BeginAnswerPeriod) " +
				"AND (DATE(A.AnswerDate)<=DATE(D.EndAnswerPeriod) OR A.AnswerDate='0001-01-01 00:00:00')" +
			"GROUP BY Q.ChildQuestion, Q.ChildDescription, Q.ChildType, D.Single " + 
			"ORDER BY DocDate, QuestionOrder ");
	query.AddParameter("emptySKU", DB.EmptyRef("Catalog_SKU"));
	query.AddParameter("integer", DB.Current.Constant.DataType.Integer);
	query.AddParameter("decimal", DB.Current.Constant.DataType.Decimal);
	query.AddParameter("string", DB.Current.Constant.DataType.String);
	query.AddParameter("snapshot", DB.Current.Constant.DataType.Snapshot);
	query.AddParameter("outlet", outlet);
	query.AddParameter("attached", Translate["#snapshotAttached#"]);
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

function CheckSelector(outlet, selector, compType, value, additionalParameter) {
	if (selector=="Catalog_OutletType"){
		if ((outlet.Type).ToString()==("@ref[Catalog_OutletType]:" + value))
			return Compare(compType, true);
		else
			return Compare(compType, false);
	}
	if (selector=="Catalog_OutletClass"){
		if ((outlet.Class).ToString()==("@ref[Catalog_OutletClass]:" + value))
			return Compare(compType, true);
		else
			return Compare(compType, false);
	}

	if (selector=="Enum_OutletStatus"){
		if ((outlet.OutletStatus).ToString()==("@ref[Enum_OutletStatus]:" + value))
			return Compare(compType, true);
		else
			return Compare(compType, false);
	}
	
	if (selector=="Catalog_Distributor"){
		if ((outlet.Distributor).ToString()==("@ref[Catalog_Distributor]:" + value))
			return Compare(compType, true);
		else
			return Compare(compType, false);
	}
	
	if (selector=="Catalog_Outlet"){
		if ((outlet.Id).ToString()==(value)){
			return Compare(compType, true);
		}
		else{
			return Compare(compType, false);
		}			
	}
	
	if (selector=="Catalog_Territory"){
		var query = new Query("SELECT Id FROM Catalog_Territory_Outlets WHERE Outlet=@outlet AND Ref=@ref")
		query.AddParameter("outlet", outlet);
		query.AddParameter("ref", ("@ref[Catalog_Territory]:" + value));
		var result = query.ExecuteScalar();		
		if (result!=null)
			return Compare(compType, true);
		else
			return Compare(compType, false);
	}
	
	if (selector=="Catalog_Region"){
		var query = new Query(GetRegionQueryText());
		query.AddParameter("outlet", outlet);
		query.AddParameter("region", "@ref[Catalog_Region]:" + value);
		var result = query.ExecuteScalar();		
		if (result!=null)
			return Compare(compType, true);
		else
			return Compare(compType, false);
	}
	
	if (selector=="Catalog_OutletParameter"){
		var query = new Query("SELECT Id FROM Catalog_Outlet_Parameters WHERE Ref=@ref AND Parameter=@param AND Value=@value");
		query.AddParameter("ref", outlet);
		query.AddParameter("value", value);
		query.AddParameter("param", additionalParameter);
		if (query.ExecuteScalar()!=null)
			return Compare(compType, true);
		else
			return Compare(compType, false);
	}
	
	if (selector=="Catalog_Positions"){
		return true;
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

function Compare(compType, equal) {
	if ((compType).ToString()==(DB.Current.Constant.ComparisonType.NotEqual).ToString()){
		if (equal)
			return false;
		else
			return true;
	}
	else{
		if (equal)
			return true;
		else
			return false;
	}
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

function GetQuestionsCount(questionnaires) {
	var query = new Query("SELECT COUNT(Question) FROM USR_Questions ");					
	var res = query.ExecuteScalar();
	return res;
}

function GetSKUQuestionsCount() {
	var str = CreateCondition(questionnaires);	
	if (String.IsNullOrEmpty(str))
		return parseInt(0);
	else{
		var query = new Query("SELECT COUNT(Id) FROM Document_Questionnaire_SKUQuestions " + str);					
		var res = query.ExecuteScalar();
		return res;
	}
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
