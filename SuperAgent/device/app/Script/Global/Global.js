

function GenerateGuid() {

	return (S4() + S4() + "-" + S4() + "-" + S4() + "-" + S4() + "-" + S4() + S4() + S4());
}

function S4() {
	return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
}

function SetSessionConstants() {

	var solVersion = new Query("SELECT Value FROM ___SolutionInfo WHERE key='version'");
	var planEnbl = new Query("SELECT LogicValue FROM Catalog_MobileApplicationSettings WHERE Description='PlanVisitEnabled'");
	var multStck = new Query("SELECT LogicValue FROM Catalog_MobileApplicationSettings WHERE Description='MultistockEnabled'");
	var stckEnbl = new Query("SELECT LogicValue FROM Catalog_MobileApplicationSettings WHERE Description='EmptyStockEnabled'");
	var orderCalc = new Query("SELECT LogicValue FROM Catalog_MobileApplicationSettings WHERE Description='RecOrderEnabled'");
	var UVR = new Query("SELECT LogicValue FROM Catalog_MobileApplicationSettings WHERE Description='ControlVisitReasonEnabled'");
	var NOR = new Query("SELECT LogicValue FROM Catalog_MobileApplicationSettings WHERE Description='ControlOrderReasonEnabled'");
	var SnapshotSize = new Query("SELECT NumericValue FROM Catalog_MobileApplicationSettings WHERE Description='SnapshotSize'");
	var SKUFeaturesRegistration = new Query("SELECT LogicValue FROM Catalog_MobileApplicationSettings WHERE Description='SKUFeaturesRegistration'");
	var coordActuality = new Query("SELECT NumericValue FROM Catalog_MobileApplicationSettings WHERE Description='UserCoordinatesActualityTime'");

	$.AddGlobal("sessionConst", new Dictionary());
	$.sessionConst.Add("solVersion", solVersion.ExecuteScalar());
	$.sessionConst.Add("PlanEnbl", EvaluateBoolean(planEnbl.ExecuteScalar()));
	$.sessionConst.Add("MultStck", EvaluateBoolean(multStck.ExecuteScalar()));
	$.sessionConst.Add("NoStkEnbl", EvaluateBoolean(stckEnbl.ExecuteScalar()));
	$.sessionConst.Add("OrderCalc", EvaluateBoolean(orderCalc.ExecuteScalar()));
	$.sessionConst.Add("UVR", EvaluateBoolean(UVR.ExecuteScalar()));
	$.sessionConst.Add("NOR", EvaluateBoolean(NOR.ExecuteScalar()));
	$.sessionConst.Add("SnapshotSize", SnapshotSize.ExecuteScalar());
	$.sessionConst.Add("SKUFeaturesRegistration", SKUFeaturesRegistration.ExecuteScalar());	
	$.sessionConst.Add("UserCoordinatesActualityTime", coordActuality.ExecuteScalar());

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
		if (rights.Code=='000000005') {
			if (rights.AccessRight==null) {
				$.sessionConst.Add("orderEnabled", false);
			} else {
				$.sessionConst.Add("orderEnabled", true);
			}
		}
		if (rights.Code=='000000006') {
			if (rights.AccessRight==null) {
				$.sessionConst.Add("returnEnabled", false);
			} else {
				$.sessionConst.Add("returnEnabled", true);
			}
		}
		if (rights.Code=='000000007') {
			if (rights.AccessRight==null) {
				$.sessionConst.Add("contractorEditable", false);
			} else {
				$.sessionConst.Add("contractorEditable", true);
			}
		}
		if (rights.Code=='000000008') {
			if (rights.AccessRight==null) {
				$.sessionConst.Add("outletContactEditable", false);
			} else {
				$.sessionConst.Add("outletContactEditable", true);
			}
		}
		if (rights.Code=='000000009') {
			if (rights.AccessRight==null) {
				$.sessionConst.Add("partnerContactEditable", false);
			} else {
				$.sessionConst.Add("partnerContactEditable", true);
			}
		}
		if (rights.Code=='000000010') {
			if (rights.AccessRight==null) {
				$.sessionConst.Add("percentDiscountEnabled", false);
			} else {
				$.sessionConst.Add("percentDiscountEnabled", true);
			}
		}
		if (rights.Code=='000000011') {
			if (rights.AccessRight==null) {
				$.sessionConst.Add("totaltDiscountEnabled", false);
			} else {
				$.sessionConst.Add("totaltDiscountEnabled", true);
			}
		}
		if (rights.Code=='000000012') {
			if (rights.AccessRight==null) {
				$.sessionConst.Add("newPriceEnabled", false);
			} else {
				$.sessionConst.Add("newPriceEnabled", true);
			}
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

function ValidateEmail(string){
	return ValidateField(string, "(([A-za-z0-9-_.]+@[a-z0-9_]+(.[a-z]{2,6})+)*)?", Translate["#email#"])
}

function ValidatePhoneNr(string){
	return true; // ValidateField(string, "([0-9()-+\s]{1,20})?", Translate["#phone#"]);
}

function ValidateField(string, regExp, fieldName){
	if (string==null)
		string = "";
	var validField = validate(string, regExp);
	if (validField==false)
		Dialog.Message(String.Format("{0} {1}", Translate["#incorrect#"], fieldName));
	return validField;
}


//--------------------------------Order functionality----------------------------

function FindTwinAndUnite(orderitem) {

	var q = new Query(
			"SELECT Id FROM Document_" + $.workflow.currentDoc + "_SKUs WHERE Ref=@ref AND SKU=@sku AND Discount=@discount AND Total=@total AND Units=@units AND Feature=@feature AND Id<>@id LIMIT 1"); // AND
																																								// Id<>@id
	q.AddParameter("ref", orderitem.Ref);
	q.AddParameter("sku", orderitem.SKU);
	q.AddParameter("discount", orderitem.Discount);
	q.AddParameter("total", orderitem.Total);
	q.AddParameter("units", orderitem.Units);
	q.AddParameter("feature", orderitem.Feature);
	q.AddParameter("id", orderitem.Id);
	var rst = q.ExecuteCount();
	if (parseInt(rst) != parseInt(0)) {
		var twin = q.ExecuteScalar();
		twin = twin.GetObject();
		twin.Qty += orderitem.Qty;
		twin.Save();
		DB.Delete(orderitem.Id);
	} else
		orderitem.Save();
}

function ClearFilter(){
	var checkDropF = new Query("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='USR_Filters'");
	var checkDropFResult = checkDropF.ExecuteScalar();

	if (checkDropFResult == 1) {
		var dropF = new Query("DELETE FROM USR_Filters");
		dropF.Execute();
	}
}

//------------------------Queries common functions------------------------------

function CreateUserTableIfNotExists(name) {
	var q = new Query("SELECT count(*) FROM sqlite_master WHERE type='table' AND name=@name");
	q.AddParameter("name", name);
	var check = q.ExecuteScalar();

	if (parseInt(check) == parseInt(1)) {
		return "DELETE FROM " + name + "; INSERT INTO " + name + " ";
	}
	else
		return "CREATE TABLE " + name + " AS ";
}
