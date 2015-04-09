// ------------------------ Main screen module ------------------------

function OnLoad() {

	if ($.Exists("finishedWorkflow") && ($.finishedWorkflow == "Sync" || $.finishedWorkflow == "Visits" || $.finishedWorkflow == "Order" || $.finishedWorkflow == "Outlets")) {
		$.swipe_layout.Index = 0;
	} else {
		$.swipe_layout.Index = 1;
	}

	var indexQuery = new Query("CREATE INDEX IF NOT EXISTS IND_QSKU ON _Document_Questionnaire_SKUs(IsTombstone, Ref, SKU)");
	indexQuery.Execute();

	var indexQuery = new Query("CREATE INDEX IF NOT EXISTS IND_AQ " +
				"ON _Catalog_Outlet_AnsweredQuestions(IsTombstone, Ref, Questionaire, Question, AnswerDate)");
	indexQuery.Execute();

}

function GetLastSyncTime() {
	if (DB.SuccessSync)
		return DB.LastSyncTime.ToString("dd.MM HH:mm");
	else
		return Translate["#error#"];
}

function CloseMenu() {
	var sl = Variables["swipe_layout"];
	if (sl.Index == 1) {
		sl.Index = 0;
	} else if (sl.Index == 0) {
		sl.Index = 1;
	}
}

function OpenMenu() {
	var sl = Variables["swipe_layout"];
	if (sl.Index == 1) {
		sl.Index = 0;
	} else if (sl.Index == 0) {
		sl.Index = 1;
	}
}

function MakeSnapshot() {
	GetCameraObject();
	Camera.MakeSnapshot();
}

function GetCameraObject() {
	FileSystem.CreateDirectory("/private/Document.Visit");
	Camera.Size = 300;
	Camera.Path = "/private/Document.Visit/1.jpg";
}

function LogoutQuery() {

	Dialog.Alert("#logoutQuery#"
		    , LogoutCallback
		    , null
		    , "#cancel#"
		    , "#logoutConfirm#"
		    , null);

}

function LogoutCallback(state, args) {

	if (args.Result == 1) {

		Application.Logout();

	}

}

// --------------------------------------------------------------------------------

//function SetIndicators(){
//	Indicators.SetIndicators();
//}

function GetOutletsCount() {
	return Indicators.GetOutletsCount();
}

function GetCommitedScheduledVisits() {
	return Indicators.GetCommitedScheduledVisits();
}

function GetUnscheduledVisits() {
	return Indicators.GetUnscheduledVisits();
}

function GetPlannedVisits(){
	return Indicators.GetPlannedVisits();
}

function GetOrderSumm() {
	return Indicators.GetOrderSumm();
}

function GetOrderQty(){
	return Indicators.GetOrderQty();
}

function GetEncashmentSumm() {
	return Indicators.GetEncashmentSumm();
}

function GetReceivablesSumm() {
	return Indicators.GetReceivablesSumm();
}

// ---------------------------Warm ups, temporary------------------

function DoWarmUp() {
	// RequestOutlets();
	// RequestSKUs();
	// RequestOrderList();
}

function RequestOutlets() {
	var q = new Query("SELECT P.Id, P.Description, P.DataType, DT.Description AS TypeDescription, OP.Id AS ParameterValue, OP.Value FROM Catalog_OutletParameter P JOIN Enum_DataType DT ON DT.Id=P.DataType LEFT JOIN Catalog_Outlet_Parameters OP ON OP.Parameter = P.Id");
	var r = q.Execute();
	while (r.Next()) {
	}
}

function RequestSKUs() {
	var q = new Query;
	q.Text = "SELECT S.Id, S.Description, PL.Price, S.CommonStock, G.Description AS GroupDescription, G.Id AS GroupId, G.Parent AS GroupParent, CB.Description AS Brand FROM Catalog_SKU S JOIN Catalog_SKUGroup G ON G.Id = S.Owner JOIN Document_PriceList_Prices PL ON PL.SKU = S.Id JOIN Catalog_Brands CB ON CB.Id=S.Brand";
	var r = q.Execute();
	while (r.Next()) {
	}
}

function RequestOrderList() {

	var q = new Query("SELECT DO.Id, DO.Outlet, DO.Date AS Date, DO.Number, CO.Description AS OutletDescription, DO.Status FROM Document_Order DO JOIN Catalog_Outlet CO ON DO.Outlet=CO.Id");
	var r = q.Execute();
	while (r.Next()) {
	}
}
