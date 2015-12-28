
// --------------------------------------------------------------------------------

function GetUnscheduledVisits() {
	return Indicators.GetUnscheduledVisits();
}

function GetEncashmentSumm() {
	return Indicators.GetEncashmentSumm();
}

function GetReceivablesSumm() {
	return Indicators.GetReceivablesSumm();
}

function GetTotal(){
	var s = Indicators.GetUnscheduledVisits() + Indicators.GetCommitedScheduledVisits();
	return s + "";
}

function GetVisitsLeft(){
	var c = GetPlannedVisits() - Indicators.GetCommitedScheduledVisits();
	return c + "";
}