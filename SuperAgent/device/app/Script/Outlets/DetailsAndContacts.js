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
	if (String.IsNullOrEmpty(planDate))
		planDate = DateTime.Now;
	var header = Translate["#enterDateTime#"];
	Dialog.ShowDateTime(header, planDate, PlanHandler, [ outlet, plan ]);
}

function DeleteContact(ref) {
	var contact = ref.GetObject();
	contact.NotActual = true;
	contact.Save();
	DB.Commit();
	Workflow.Refresh([ $.outlet ]);
}

function SelectOwnership() {
	var ownDictionary = CreateOwnershipDictionary();
	var q = new Query();
	q.Text = "SELECT Id, Description FROM Enum_OwnershipType";
	var res = q.Execute().Unload();
	var arr = [];	
	
	while (res.Next()) {
		arr.push([res.Id, ownDictionary[res.Description]]);
	}
		
	Dialog.Select("#select_answer#", arr, CallBack1, $.outlet);
	
}

function CallBack1(key, args) {
	var obj = args.GetObject();
	obj.OwnershipType = key;
	obj.Save();
	Workflow.Refresh([]);
}

// --------------------internal--------------

function EmptyContact(contact) {
	if (String.IsNullOrEmpty(contact.ContactName) && String.IsNullOrEmpty(contact.PhoneNumber) && String.IsNullOrEmpty(contact.Email) && String.IsNullOrEmpty(contact.Position))
		return true;
	else
		return false;
}

function PlanHandler(date, arr) {
	var outlet = arr[0];
	var plan = arr[1];
	if (plan == null) {
		plan = DB.Create("Document.MobileAppPlanVisit");
		plan.SR = $.common.UserRef;
		plan.Outlet = outlet;
		plan.Transformed = false;
		plan.Date = DateTime.Now;
	} else
		plan = plan.GetObject();
	plan.PlanDate = date;
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
		if (EmptyContact(entity) && entity.IsNew()) {
			DB.Delete(entity);
			DB.Commit();
			return true;
		}
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
	if (String.IsNullOrEmpty(entity.ContactName)) {
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
	d.Add("ZAO", "Р—РђРћ");
	d.Add("OOO", "OOO");
	d.Add("IP", "Р�Рџ");
	d.Add("NKO", "РќРљРћ");
	d.Add("OAO", "OAO");
	d.Add("OP", "РћРџ");
	d.Add("TSJ", "РўРЎР–");
	return d;
}
