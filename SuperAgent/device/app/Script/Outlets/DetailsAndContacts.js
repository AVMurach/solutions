var outlet;

function OnLoad() {
	outlet = $.param1;
}

function CreateContactIfNotExist(contact, outlet) {

	if (contact == null) {
		contact = DB.Create("Catalog.Outlet_Contacts");
		contact.Ref = outlet;
		contact.NotActual = false;
		contact.Save();
		return contact.Id;
	} else
		return contact;
}

function SaveAndBack(entity, validateOutlet) {
	if (ValidEntity(entity)) {
		entity.GetObject().Save();
		Workflow.Back();
	}
}

function GetString(ref) {
	if (ref.EmptyRef()) {
		$.Add("style", "comment_row");
		return Translate["#select_answer_low#"];
	} else {
		$.Add("style", "main_row");
		var ownDictionary = CreateOwnershipDictionary();
		return ownDictionary[ref.Description];
	}
}

function GetContacts(outlet) {
	var q = new Query("SELECT C.Id, C.ContactName, P.Description AS Position, PhoneNumber, Email FROM Catalog_Outlet_Contacts C LEFT JOIN Catalog_Positions P ON C.Position=P.Id WHERE C.Ref=@ref AND C.NotActual=0 ORDER BY C.ContactName");
	q.AddParameter("ref", outlet);
	return q.Execute();
}

function GetPlans(outlet, sr) {
	var q = new Query("SELECT Id, strftime('%Y-%m-%d %H:%M', PlanDate) AS PlanDate FROM Document_MobileAppPlanVisit WHERE Outlet=@outlet AND SR=@sr AND Transformed = 0");
	q.AddParameter("outlet", outlet);
	q.AddParameter("sr", $.common.UserRef);
	return q.Execute();
}

function CreatePlan(outlet, plan, planDate) {
	Dialogs.ChooseDateTime(plan, "PlanDate", null, PlanHandler); //(header, planDate, PlanHandler, [ outlet, plan ]);
}

function DeleteContact(ref) {
	var contact = ref.GetObject();
	contact.NotActual = true;
	contact.Save();
	DB.Commit();
	Workflow.Refresh([ $.outlet ]);
}

function SelectOwnership(control) {
	var ownDictionary = CreateOwnershipDictionary();
	var q = new Query();
	q.Text = "SELECT Id, Description FROM Enum_OwnershipType";// UNION SELECT NULL, '—' ORDER BY Description";
	var res = q.Execute().Unload();

	Dialogs.DoChoose(q.Execute().Unload(), $.outlet, "OwnershipType", control, null, Translate["#ownership#"]);

}


// --------------------internal--------------

function EmptyContact(contact) {
	if (String.IsNullOrEmpty(contact.ContactName) && String.IsNullOrEmpty(contact.PhoneNumber) && String.IsNullOrEmpty(contact.Email) && String.IsNullOrEmpty(contact.Position))
		return true;
	else
		return false;
}

function PlanHandler(state, args) {
	var plan = state[0];
	if (plan == null) {
		plan = DB.Create("Document.MobileAppPlanVisit");
		plan.SR = $.common.UserRef;
		plan.Outlet = outlet;
		plan.Transformed = false;
		plan.Date = DateTime.Now;
	} else
		plan = plan.GetObject();
	plan.PlanDate = args.Result;
	plan.Save();
	Workflow.Refresh([ outlet ]);
}

function SavePhoneAndCall(contact) {
	contact = contact.GetObject();
	DoCall(contact.PhoneNumber);
}

function DialogCallBack(control, key) {
	var v = null;
	if ($.Exists("param2"))
		v = $.param2;

	Workflow.Refresh([ $.contact, $.outlet ]);
}

function ValidEntity(entity) {

	// Validate Contact
	if (getType(entity.GetObject()) == "DefaultScope.Catalog.Outlet_Contacts") {
		if (Global.ValidatePhoneNr(entity.PhoneNumber) && Global.ValidateEmail(entity.Email) && ValidateContactName(entity))
			return true;
		else
			return false;
	}

	// Validate Details
	if (getType(entity.GetObject()) == "DefaultScope.Catalog.Outlet")
		return ValidateOutlet(entity);
}

function ValidateContactName(entity) {
	if (String.IsNullOrWhiteSpace(entity.ContactName)) {
		Dialog.Message(String.Format("{0} {1}", Translate["#incorrect#"], Translate["#contactName#"]));
		return false;
	} else
		return true;
}

function ValidateOutlet(entity) {

	var emailValid = Global.ValidateEmail(entity.Email);
	var phoneNumValid = Global.ValidatePhoneNr(entity.PhoneNumber);
	var innValid = Global.ValidateField(entity.INN, "([0-9]{10}|[0-9]{12})?", Translate["#inn#"]);
	var kppValid = Global.ValidateField(entity.KPP, "([0-9]{9})?", Translate["#kpp#"]);

	if (emailValid && phoneNumValid && innValid && kppValid) {
		return true;
	}
	return false;
}

function CreateOwnershipDictionary() {
	var d = new Dictionary();
	d.Add("ZAO", "ЗАО");
	d.Add("OOO", "OOO");
	d.Add("IP", "ИП");
	d.Add("NKO", "НКО");
	d.Add("OAO", "OAO");
	d.Add("OP", "ОП");
	d.Add("TSJ", "ТСЖ");
	return d;
}
