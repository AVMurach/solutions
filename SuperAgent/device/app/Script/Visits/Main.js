
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

	var search = "";
	var q = new Query();
	if (String.IsNullOrEmpty(searchText)==false) {
		searchText = StrReplace(searchText, "'", "''");
		search = "AND Contains(O.Description, '" + searchText + "') ";
	}
	q.Text = ("SELECT DISTINCT VP.Outlet, VP.Ref, " +
			" CASE WHEN strftime('%H:%M', VP.Date)='00:00' THEN '' ELSE strftime('%H:%M', VP.Date) END AS Time, " + 
			OutletStatusText() +
			" FROM Catalog_Outlet O " +
			" JOIN Document_VisitPlan_Outlets VP ON O.Id = VP.Outlet AND DATE(VP.Date)=DATE(@date) " +
			" LEFT JOIN Document_Visit V ON VP.Outlet=V.Outlet AND V.Date >= @today AND V.Date < @tomorrow AND V.Plan<>@emptyRef " +
			" LEFT JOIN Catalog_OutletsStatusesSettings OSS ON O.OutletStatus = OSS.Status AND OSS.DoVisitInMA=1 " +
			" WHERE V.Id IS NULL AND NOT OSS.Status IS NULL " + search + " ORDER BY O.Description LIMIT 100");
	q.AddParameter("date", DateTime.Now.Date);
	q.AddParameter("today", DateTime.Now.Date);
	q.AddParameter("tomorrow", DateTime.Now.Date.AddDays(1));
	q.AddParameter("emptyRef", DB.EmptyRef("Document_VisitPlan"));
	return q.Execute();

}

function GetUncommitedScheduledVisitsCount(searchText) {

	var search = "";
	var q = new Query();
	if (String.IsNullOrEmpty(searchText)==false) {
		searchText = StrReplace(searchText, "'", "''");
		search = "AND Contains(O.Description, '" + searchText + "') ";
	}
	q.Text = ("SELECT COUNT(DISTINCT VP.Outlet) " +
			" FROM Catalog_Outlet O JOIN Document_VisitPlan_Outlets VP ON O.Id = VP.Outlet AND DATE(VP.Date)=DATE(@date) " +
			" LEFT JOIN Document_Visit V ON VP.Outlet=V.Outlet AND V.Date >= @today AND V.Date < @tomorrow AND V.Plan<>@emptyRef LEFT JOIN Catalog_OutletsStatusesSettings OSS ON O.OutletStatus = OSS.Status AND OSS.DoVisitInMA=1 " +
			" WHERE V.Id IS NULL AND NOT OSS.Status IS NULL " + search + " ORDER BY O.Description LIMIT 100");
	q.AddParameter("date", DateTime.Now.Date);
	q.AddParameter("today", DateTime.Now.Date);
	q.AddParameter("tomorrow", DateTime.Now.Date.AddDays(1));
	q.AddParameter("emptyRef", DB.EmptyRef("Document_VisitPlan"));
	return q.ExecuteScalar();

}

function GetScheduledVisitsCount() {
	var q = new Query("SELECT COUNT(VPO.Id) FROM Document_VisitPlan_Outlets VPO LEFT JOIN Catalog_Outlet O ON VPO.Outlet = O.Id LEFT JOIN Catalog_OutletsStatusesSettings OSS ON O.OutletStatus = OSS.Status AND OSS.DoVisitInMA = 1 WHERE Date >= @today AND Date < @tomorrow AND NOT OSS.Status IS NULL");
	q.AddParameter("today", DateTime.Now.Date);
	q.AddParameter("tomorrow", DateTime.Now.Date.AddDays(1));
	var cnt = q.ExecuteScalar();
	if (cnt == null)
		return 0;
	else
		return cnt;
}

function GetCommitedScheduledVisits(searchText) {

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

function GetOutletsCount() {
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
	Workflow.Action(actionName, []);
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