function GetDistr(searchText) {
	var search = "";
	if (String.IsNullOrEmpty(searchText)==false)
		search = "WHERE Contains(C.Description, '" + searchText + "') ";
	
	var q = new Query("SELECT C.Id, C.Description FROM Catalog_Distributor C " + search + " ORDER BY C.Description");
	return q.Execute();
}

function SetObj(distr, outlet){
	
	if (Variables.Exists("setDistr"))
		$.Remove("setDistr");
	$.AddGlobal("setDistr", distr);
	
	outlet = outlet.GetObject();
	outlet.Distributor = distr;
	outlet.Save();
	
	Workflow.Back();
}


