﻿// ------------------------ Main screen module ------------------------

function OnLoad() {

	if ($.Exists("finishedWorkflow") && ($.finishedWorkflow == "Sync" || $.finishedWorkflow == "Visits" || $.finishedWorkflow == "Order" || $.finishedWorkflow == "Outlets" || $.finishedWorkflow == "Return")) {
		$.swipe_layout.Index = 0;
	} else {
		$.swipe_layout.Index = 1;
	}

}

function GetLastSyncTime() {
	if (DB.SuccessSync)
		return DB.LastSyncTime.ToString("dd.MM HH:mm");
	else
		return Translate["#error#"];
}

function GetMainVersion(ver) {
	if (ver==null)
		ver = "";
	return Left(ver, 3);
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

function GetReturnQty(){
	return Indicators.GetReturnQty();
}

function GetReturnSum(){
	return Indicators.GetReturnSum();
}
