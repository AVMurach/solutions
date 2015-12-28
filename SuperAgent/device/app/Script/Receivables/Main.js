var amount;
var overdueAmount;
var editingItem;
//var receivablesRecdset;

function OnLoad() {
	editingItem = null;
}

function GetHeader(outlet) {
	GetAmount(outlet);
	GetOverdueAmount(outlet);
}

function GetReceivables(outlet) {

	var receivables = new Query("SELECT RD.DocumentName, RD.DocumentSum, RD.Overdue, E.ID AS EncItem, E.EncashmentSum AS EncSum " + //IFNULL(E.EncashmentSum, '') AS EncSum" +
			" FROM Document_AccountReceivable_ReceivableDocuments RD " +
			" JOIN Document_AccountReceivable AR ON AR.Id=RD.Ref AND AR.Outlet = @outlet " +
			" LEFT JOIN Document_Encashment_EncashmentDocuments E ON E.Ref = @encashment AND E.DocumentName=RD.DocumentName " +
			" ORDER BY AR.Date, RD.LineNumber");
	receivables.AddParameter("encashment", $.workflow.encashment);
	receivables.AddParameter("outlet", outlet);
	var r = receivables.Execute();

	return r;
}

function ValidateEncashments() {
	var i = 0;
	while ($.Exists(("control" + i))) {
		var valid = ValidateField(Variables["control" + i].Text, "[0-9\\.,]*", Translate["#encashment#"]);
		if (valid == false)
			return false;
		i = i + 1;
	}
	return true;
}

function GetAmount(outlet) {
	var receivables = new Query("SELECT SUM(RD.DocumentSum) " +
			" FROM Document_AccountReceivable_ReceivableDocuments RD " +
			" JOIN Document_AccountReceivable AR ON AR.Id=RD.Ref AND AR.Outlet = @outlet" +
			" ORDER BY RD.LineNumber");
	receivables.AddParameter("outlet", outlet);
	amount = FormatValue(receivables.ExecuteScalar());
}

function RefreshAmount(control, encashment, encasmentItem, receivableDoc) {

	if (encasmentItem==null)
		encasmentItem = CreateEncashmentItem(encashment, receivableDoc);
	editingItem = encasmentItem;

	if (ValidateField(control.Text, "[0-9\\.,]*", Translate["#encashment#"])) {
		encasmentItem = encasmentItem.GetObject();
		if (String.IsNullOrEmpty(control.Text))
			encasmentItem.EncashmentSum = 0;
		else
			encasmentItem.EncashmentSum = parseFloat(control.Text);
		encasmentItem.Save();

		var q = new Query("SELECT SUM(EncashmentSum) FROM Document_Encashment_EncashmentDocuments WHERE Ref=@ref");
		q.AddParameter("ref", encashment);
		var s = q.ExecuteScalar();

		encashment = encashment.GetObject();
		encashment.EncashmentAmount = FormatValue(s);
		encashment.Save();
		//$.encAmount.Text = FormatValue(s);
		//Workflow.Refresh([]);
	}
}

function CreateEncashmentIfNotExist(visit) {// , textValue) {
	var query = new Query("SELECT Id FROM Document_Encashment WHERE Visit=@visit");
	query.AddParameter("visit", visit);
	var encashment = query.ExecuteScalar();

	if (encashment == null) {
		encashment = DB.Create("Document.Encashment");
		encashment.Visit = visit;
		encashment.Date = DateTime.Now;
		encashment.EncashmentAmount = parseInt(0);
		encashment.Save();
		encashment = encashment.Id;
	}

	return encashment;
}

function CreateEncashmentItem(encashment, receivableDoc) {

	if (editingItem == null) {
		encItem = DB.Create("Document.Encashment_EncashmentDocuments");
		encItem.Ref = encashment;
		encItem.DocumentName = receivableDoc;
		encItem.EncashmentSum = 0;
		encItem.Save();
		encItem = encItem.Id;
	}
	else
		encItem = editingItem;
	return encItem;
}

function SpreadEncasmentAndRefresh(encashment, outlet, receivables) {

	SaveSum($.encAmount);
	receivables = GetReceivables(outlet);

	var sumToSpread = encashment.EncashmentAmount;
	while (receivables.Next()) {

		if (parseInt(0)!=parseInt(sumToSpread)) {
			var encRowObj;
			if (receivables.EncItem==null){
				encRowObj = CreateEncashmentItem(encashment, receivables.DocumentName);
				encRowObj = encRowObj.GetObject();
			}
			else
				encRowObj = receivables.encItem.GetObject();

			if (Converter.ToDecimal(sumToSpread) > Converter.ToDecimal(receivables.DocumentSum)) {
				encRowObj.EncashmentSum = FormatValue(receivables.DocumentSum);
				sumToSpread = sumToSpread - receivables.DocumentSum;
			} else {
				encRowObj.EncashmentSum = FormatValue(sumToSpread);
				sumToSpread = Converter.ToDecimal(0);
			}
			encRowObj.Save();
		}
		else{
			if (receivables.encItem!=null) {
				DB.Delete(receivables.encItem);
			}
		}
	}
	Workflow.Refresh([]);
}

function SaveAndForward(encashment) {
	ClearEmptyRecDocs(encashment);
	if (parseFloat(encashment.EncashmentAmount) != parseFloat(0))
		encashment.GetObject().Save();
	else
		DB.Delete(encashment);
	Workflow.Forward([]);
}

function ClearEmptyRecDocs(encashment) {
	var q = new Query("SELECT Id, EncashmentSum FROM Document_Encashment_EncashmentDocuments WHERE Ref=@ref AND EncashmentSum = 0");
	q.AddParameter("ref", encashment);
	var rows = q.Execute();
	while (rows.Next()) {
		DB.Delete(rows.Id);
	}
}

function GetOverdueAmount(outlet) {
	var q = new Query("SELECT SUM(R.DocumentSum) " +
			" FROM Document_AccountReceivable_ReceivableDocuments R " +
			" JOIN Document_AccountReceivable A ON A.Id=R.Ref AND A.Outlet = @outlet" +
			" WHERE Overdue=1");
	q.AddParameter("outlet", outlet);

	overdueAmount = FormatValue(q.ExecuteScalar());
}

function FormatSum(control, value) {

	if (value==null || parseInt(value)==parseInt(0))
		return "";
	else
		return String.Format("{0:F2}", value);

}

function FormatAmount(control) {
	if (control.Text==null || parseInt(control.Text)==parseInt(0))
		control.Text = "";
	else
		control.Text = String.Format("{0:F2}", control.Text);
}

function SaveSum(sender) {
	var enc = $.workflow.encashment.GetObject();
	if (sender.Text == '.') {
		sender.Text = '';
	}
	else if (TrimAll(sender.Text) == TrimAll('-')){
		sender.Text = "";
	}
	else {
		enc.EncashmentAmount = ToDecimal(sender.Text);
		sender.Text = enc.EncashmentAmount;
		enc.Save();
	}
}

//------------------------------Temporary, from global----------------

function ValidateField(string, regExp, fieldName){
	if (string==null)
		string = "";
	var dotPosition = Find(string, ",");
	var commaPosition = Find(string, ".");
	var validDotAndComma = ((dotPosition > 0 && commaPosition == 0 || commaPosition > 0 && dotPosition == 0 || dotPosition == 0 && commaPosition == 0) ? true : false);
	var validField = validate(string, regExp) && validDotAndComma;
	if (validField==false)
		Dialog.Message(String.Format("{0} {1}", Translate["#incorrect#"], fieldName));
	return validField;
}
