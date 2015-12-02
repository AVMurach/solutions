
// ------------------------ UI calls ------------------------

function OnLoading(){
	SetListType();
}

function SetListType() {
	if ($.Exists("visitsType") == false)
		$.AddGlobal("visitsType", "planned");
	else
		return $.visitsType;
}

function ChangeListAndRefresh(control) {
	$.Remove("visitsType");
	$.AddGlobal("visitsType", control);
	Workflow.Refresh([]);
}

function GetUncommitedScheduledVisits(searchText) {

	//AVMurach +
	if(recvStartPeriod == undefined){
		if(recvStopPeriod == undefined){
			var listValue = "SELECT DISTINCT VP.Outlet, VP.Ref, ";
			var todayTrue = " 1 AS todayTrue, ";
			var visitPlanTable = " JOIN Document_VisitPlan_Outlets VP ON O.Id = VP.Outlet AND DATE(VP.Date)=DATE(@date) ";
			var visitTable = " LEFT JOIN Document_Visit V ON VP.Outlet=V.Outlet AND V.Date >= @today AND V.Date < @tomorrow AND V.Plan<>@emptyRef ";
			var orderBy = " ORDER BY Time, O.Description LIMIT 100";
			
		}
	}else{
		if(recvStopPeriod == undefined){
			var listValue = "SELECT VP.Outlet, VP.Ref, strftime('%d.%m', VP.Date) AS DateV, ";
			var todayTrue = " CASE WHEN strftime('%d.%m', VP.Date)=strftime('%d.%m', 'now') THEN 1 ELSE 0 END AS todayTrue, ";
			var visitTable = " LEFT JOIN Document_Visit V ON VP.Outlet=V.Outlet AND strftime('%d.%m', V.Date)=strftime('%d.%m', VP.Date) AND V.Plan<>@emptyRef ";
			var orderBy = " ORDER BY VP.Date, Time, O.Description LIMIT 100";
			var visitPlanTable = " JOIN Document_VisitPlan_Outlets VP ON O.Id = VP.Outlet AND VP.Date >= @StartPeriod AND VP.Date < @StopPeriod ";
		}else{
			var listValue = "SELECT VP.Outlet, VP.Ref, strftime('%d.%m', VP.Date) AS DateV, ";
			var todayTrue = " CASE WHEN strftime('%d.%m', VP.Date)=strftime('%d.%m', 'now') THEN 1 ELSE 0 END AS todayTrue, ";
			var visitTable = " LEFT JOIN Document_Visit V ON VP.Outlet=V.Outlet AND strftime('%d.%m', V.Date)=strftime('%d.%m', VP.Date) AND V.Plan<>@emptyRef ";
			var orderBy = " ORDER BY DateV, Time, O.Description, Time LIMIT 100";
			var visitPlanTable = " JOIN Document_VisitPlan_Outlets VP ON O.Id = VP.Outlet AND VP.Date >= @StartPeriod AND VP.Date < @StopPeriod ";
		}
	}			
			
	
	var search = "";
	var q = new Query();
	if (String.IsNullOrEmpty(searchText)==false) {
		searchText = StrReplace(searchText, "'", "''");
		search = "AND Contains(O.Description, '" + searchText + "') ";
	}
	q.Text = (listValue + todayTrue +
			" CASE WHEN strftime('%H:%M', VP.Date)='00:00' THEN '' ELSE strftime('%H:%M', VP.Date) END AS Time, " + 
			OutletStatusText() +
			" FROM Catalog_Outlet O " +
			visitPlanTable +
			visitTable +
			" LEFT JOIN Catalog_OutletsStatusesSettings OSS ON O.OutletStatus = OSS.Status AND OSS.DoVisitInMA=1 " +
			" WHERE V.Id IS NULL AND NOT OSS.Status IS NULL " + search + orderBy);
	q.AddParameter("date", DateTime.Now.Date);
	q.AddParameter("today", DateTime.Now.Date);
	q.AddParameter("tomorrow", DateTime.Now.Date.AddDays(1));
	q.AddParameter("emptyRef", DB.EmptyRef("Document_VisitPlan"));
	q.AddParameter("StartPeriod", recvStartPeriod);
		
	if(recvStopPeriod != undefined){
		q.AddParameter("StopPeriod", Date(recvStopPeriod).AddSeconds(1));		
	}else{
		q.AddParameter("StopPeriod", recvStopPeriod);
	}
	return q.Execute();
	
	//AVMurach -

}

function GetUncommitedScheduledVisitsCount(searchText) {
	
	//AVMurach +
	if(recvStartPeriod == undefined){
		if(recvStopPeriod == undefined){
			var listValue = "SELECT DISTINCT VP.Outlet, VP.Ref, ";
			var todayTrue = " 1 AS todayTrue, "
			var visitTable = " LEFT JOIN Document_Visit V ON VP.Outlet=V.Outlet AND V.Date >= @today AND V.Date < @tomorrow AND V.Plan<>@emptyRef ";
			var orderBy = " ORDER BY O.Description LIMIT 100";	
			var visitPlanTable = " JOIN Document_VisitPlan_Outlets VP ON O.Id = VP.Outlet AND DATE(VP.Date)=DATE(@date) "
		}
	}else{
		if(recvStopPeriod == undefined){
			var listValue = "SELECT VP.Outlet, VP.Ref, strftime('%d.%m', VP.Date) AS DateV, ";
			var todayTrue = " CASE WHEN strftime('%d.%m', VP.Date)=strftime('%d.%m', 'now') THEN 1 ELSE 0 END AS todayTrue, "
			var visitTable = " LEFT JOIN Document_Visit V ON VP.Outlet=V.Outlet AND strftime('%d.%m', V.Date)=strftime('%d.%m', VP.Date) AND V.Plan<>@emptyRef ";
			var orderBy = " ORDER BY VP.Date, O.Description LIMIT 100";
			var visitPlanTable = " JOIN Document_VisitPlan_Outlets VP ON O.Id = VP.Outlet AND VP.Date >= @StartPeriod AND VP.Date < @StopPeriod "
		}else{
			var listValue = "SELECT VP.Outlet, VP.Ref, strftime('%d.%m', VP.Date) AS DateV, ";
			var todayTrue = " CASE WHEN strftime('%d.%m', VP.Date)=strftime('%d.%m', 'now') THEN 1 ELSE 0 END AS todayTrue, "
			var visitTable = " LEFT JOIN Document_Visit V ON VP.Outlet=V.Outlet AND strftime('%d.%m', V.Date)=strftime('%d.%m', VP.Date) AND V.Plan<>@emptyRef ";
			var orderBy = " ORDER BY VP.Date, O.Description LIMIT 100";
			var visitPlanTable = " JOIN Document_VisitPlan_Outlets VP ON O.Id = VP.Outlet AND VP.Date >= @StartPeriod AND VP.Date < @StopPeriod "
		}
	}
	
	
	var search = "";
	var q = new Query();
	if (String.IsNullOrEmpty(searchText)==false) {
		searchText = StrReplace(searchText, "'", "''");
		search = "AND Contains(O.Description, '" + searchText + "') ";
	}
	q.Text = ("SELECT COUNT(VP.Outlet) " +
			" FROM Catalog_Outlet O " +
			visitPlanTable +
			visitTable +
			" LEFT JOIN Catalog_OutletsStatusesSettings OSS ON O.OutletStatus = OSS.Status AND OSS.DoVisitInMA=1 " +
			" WHERE V.Id IS NULL AND NOT OSS.Status IS NULL " + search + orderBy);
	q.AddParameter("date", DateTime.Now.Date);
	q.AddParameter("today", DateTime.Now.Date);
	q.AddParameter("tomorrow", DateTime.Now.Date.AddDays(1));
	q.AddParameter("emptyRef", DB.EmptyRef("Document_VisitPlan"));
	q.AddParameter("StartPeriod", recvStartPeriod);
	q.AddParameter("StopPeriod", recvStopPeriod);
	
	return q.ExecuteScalar();
	
}

function GetScheduledVisitsCount() {
	
	if(recvStartPeriod == undefined){
		var startDate = DateTime.Now.Date;
	}else{
		var startDate = recvStartPeriod;
	}
	
	if(recvStopPeriod == undefined){
		var endDate = DateTime.Now.Date.AddDays(1);
	}else{
		var endDate = recvStopPeriod;
	}
	
	
	var q = new Query("SELECT COUNT(VPO.Id) FROM Document_VisitPlan_Outlets VPO LEFT JOIN Catalog_Outlet O ON VPO.Outlet = O.Id LEFT JOIN Catalog_OutletsStatusesSettings OSS ON O.OutletStatus = OSS.Status AND OSS.DoVisitInMA = 1 WHERE Date >= @today AND Date < @tomorrow AND NOT OSS.Status IS NULL");
	q.AddParameter("today", startDate);
	q.AddParameter("tomorrow", endDate);
	var cnt = q.ExecuteScalar();
	if (cnt == null)
		return 0;
	else
		return cnt;
}

function GetCommitedVisits(searchText) {

	//на самом деле функция возвращает все визиты подряд, но мне кажется что это ненадолго, поэтому в комментарии - еще вариант запроса, отражающий изначальный смысл

	var search = "";
	if (String.IsNullOrEmpty(searchText)==false) {
		searchText = StrReplace(searchText, "'", "''");
		search = "AND Contains(O.Description, '" + searchText + "') ";
	}

//	var q = new Query("SELECT DISTINCT VP.Outlet FROM Document_Visit V JOIN Document_VisitPlan_Outlets VP ON VP.Outlet=V.Outlet JOIN Catalog_Outlet O ON O.Id = VP.Outlet WHERE V.Date >= @today AND V.Date < @tomorrow AND VP.Date >= @today AND VP.Date < @tomorrow " + search + " ORDER BY O.Description LIMIT 100");
	var q = new Query("SELECT V.Outlet, O.Description, O.Address, " + OutletStatusText() +
		"FROM Catalog_Outlet O JOIN Document_Visit V ON V.Outlet=O.Id AND V.Date >= @today AND V.Date < @tomorrow");
	q.AddParameter("today", DateTime.Now.Date);
	q.AddParameter("tomorrow", DateTime.Now.Date.AddDays(1));
	return q.Execute();

}

function GetCommitedScheduledVisitsCount(searchText) {
	//на самом деле функция возвращает все визиты подряд, но мне кажется что это ненадолго, поэтому в комментарии - еще вариант запроса, отражающий изначальный смысл

	var search = "";
	if (String.IsNullOrEmpty(searchText)==false) {
		searchText = StrReplace(searchText, "'", "''");
		search = "AND Contains(O.Description, '" + searchText + "') ";
	}

//	var q = new Query("SELECT DISTINCT VP.Outlet FROM Document_Visit V JOIN Document_VisitPlan_Outlets VP ON VP.Outlet=V.Outlet JOIN Catalog_Outlet O ON O.Id = VP.Outlet WHERE V.Date >= @today AND V.Date < @tomorrow AND VP.Date >= @today AND VP.Date < @tomorrow " + search + " ORDER BY O.Description LIMIT 100");
	var q = new Query("SELECT COUNT(V.Outlet) " +
		"FROM Catalog_Outlet O JOIN Document_Visit V ON V.Outlet=O.Id AND V.Date >= @today AND V.Date < @tomorrow");
	q.AddParameter("today", DateTime.Now.Date);
	q.AddParameter("tomorrow", DateTime.Now.Date.AddDays(1));
	return q.ExecuteScalar();
}

function GetOutlets(searchText) {

	var search = "";
	var q = new Query();
	var showOutlet = "";
	var doVisit = "";

	if (String.IsNullOrEmpty(searchText)==false) {
		searchText = StrReplace(searchText, "'", "''");
		search = "WHERE Contains(O.Description, '" + searchText + "') ";
	}

	q.Text = "SELECT O.Id AS Outlet, O.Description, O.Address," + OutletStatusText() +
			"FROM Catalog_Outlet O " +
			"JOIN Catalog_OutletsStatusesSettings OS ON OS.Status=O.OutletStatus AND OS.DoVisitInMA=1 AND OS.ShowOutletInMA=1 " +
			search + " ORDER BY O.Description LIMIT 500";

	return q.Execute();

}

function CountOutlets() {
	var q = new Query("SELECT COUNT(O.Id) FROM Catalog_Outlet O LEFT JOIN Catalog_OutletsStatusesSettings OSS ON O.OutletStatus = OSS.Status AND OSS.DoVisitInMA = 1 WHERE NOT OSS.Status IS NULL ORDER BY O.Description LIMIT 100");
	var cnt = q.ExecuteScalar();
	if (cnt == null)
		return 0;
	else
		return cnt;
}

function AddGlobalAndAction(planVisit, outlet, actionName) {
	$.AddGlobal("planVisit", planVisit);
	$.AddGlobal("outlet", outlet);
	GlobalWorkflow.SetOutlet(outlet);
	Workflow.Action(actionName, []);
}



//-------------------------------------filter Date--------------------------------

function MakeFilterSettingsBackUp(){
	
	if ($.Exists("BUFilterCopy") == true){
		$.Remove("BUFilterCopy");
		$.Add("BUFilterCopy", new Dictionary());
		$.BUFilterCopy.Add("Start", recvStartPeriod);
		$.BUFilterCopy.Add("Stop", recvStopPeriod);
	} else {
		$.Add("BUFilterCopy", new Dictionary());
		$.BUFilterCopy.Add("Start", recvStartPeriod);
		$.BUFilterCopy.Add("Stop", recvStopPeriod);
	}			
}

function RollBackAndBack(){
	recvStartPeriod = $.BUFilterCopy.Start;
	recvStopPeriod = $.BUFilterCopy.Stop;
	Workflow.Back();
	
}

function ChekAndBack(){
	if (recvStartPeriod > recvStopPeriod) {
		Dialog.Message(Translate["#endDateLessStartDate#"]);  //"Дата окончания не может быть меньше даты начала.
		return;
	}
	
	if (recvStartPeriod != undefined) {
		if (recvStopPeriod == undefined) {			
			Dialog.Message(Translate["#endDateUndefined#"]);  //"Дата начала не установлена.
			return;
		}		
	}else{
		if (recvStopPeriod != undefined) {			
			Dialog.Message(Translate["#startDateUndefined#"]);  //"Дата окончания не установлена.
			return;
		}
	}
	
	Workflow.Back();
	
}

function clearmyfilter(){
	$.beginDate.Text = "";
	recvStartPeriod = undefined;
	$.endDate.Text = "";
	recvStopPeriod = undefined;
}

function SetBeginDate() {
	var header = Translate["#enterDateTime#"];
	if(recvStartPeriod != undefined){
		Dialog.DateTime(header, recvStartPeriod, SetBeginDateNow);
	} else {
		Dialog.DateTime(header, SetBeginDateNow);
	}
}

function SetBeginDateNow(state, args) {
	var key = args.Result;
	
	if(BegOfDay(key) < BegOfDay(DateTime.Now)){
		var setDate = BegOfDay(DateTime.Now);		
	}else{
		var setDate = BegOfDay(key);
	};
		
	$.beginDate.Text = filterDate(setDate);
		
	recvStartPeriod = setDate;
	//Workflow.Refresh([]);
}

function SetEndDate() {
	var header = Translate["#enterDateTime#"];
	if(recvStopPeriod != undefined){
		Dialog.DateTime(header, recvStopPeriod, SetEndDateNow);
	} else {
		Dialog.DateTime(header, SetEndDateNow);
	}
}

function SetEndDateNow(state, args) {
	var key = args.Result;
	$.endDate.Text = filterDate(key);
	recvStopPeriod = EndOfDay(key);
	//Dialog.Debug(BegOfDay(key));
	//Workflow.Refresh([]);
}

function filterDate(dt){
	if (dt != null){
		return String.Format("{0:dd MMMM yyyy}", DateTime.Parse(dt));
	} else {
		return "";
	}
}

function filterDateCaption(dt){
	if (dt != null){
		return String.Format("{0:dd.MM.yyyy}", DateTime.Parse(dt));
	} else {
		return "";
	}
}

function StrDatePeriod(firstDate, secondDate){
	
	if(firstDate == undefined){
		if(secondDate == undefined){
			var strPeriod = "Сегодня";
		}
	}else{
		var strFirstDate = filterDateCaption(firstDate);
		var strSecondDate = filterDateCaption(secondDate);
		
		var strPeriod = strFirstDate + " - " + strSecondDate;
	}
			
	return strPeriod
}

function ClearFilter(){
	recvStartPeriod = undefined;
	recvStopPeriod = undefined;
	Workflow.Refresh([]);
}


//-------------------------------------Internal functions--------------------------------


function OutletStatusText(){
	var os = "";

	if ($.sessionConst.encashEnabled){
		os = "(SELECT CASE WHEN COUNT(DISTINCT D.Overdue) = 2 THEN 2	WHEN COUNT(DISTINCT D.Overdue) = 0 THEN 3 " +
			"ELSE MAX(D.Overdue) END AS st " +
			"FROM Document_AccountReceivable_ReceivableDocuments D JOIN Document_AccountReceivable A ON D.Ref=A.Id " +
			"WHERE A.Outlet=O.Id) AS OutletStatus ";
	}
	else
		os = " 3 AS OutletStatus ";

	return os;
}


function Test(par){
	Dialog.Debug(par);
	return par
}
