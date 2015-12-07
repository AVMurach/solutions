var currentMenuItem;

function SetMenuItem(name){
	currentMenuItem = name;
}

function GetMenuItem(){
	return currentMenuItem;
}


var outlet;

function SetOutlet(value){
	outlet = value;
}

function GetOutlet(){
	return outlet;
}


var outletIsCreated;

function SetOutletIsCreated(value){
	outletIsCreated = value;
}

function GetOutletIsCreated(){
	return outletIsCreated;
}


var massDiscount;

function SetMassDiscount(discount){
	massDiscount = discount;
}

function GetMassDiscount(order){
	if (String.IsNullOrEmpty(massDiscount))
	{
		var q = new Query("SELECT COUNT(DISTINCT Discount) " +
			" FROM Document_Order_SKUs " +
			" WHERE Ref=@ref");
		q.AddParameter("ref", order);
		var discounts = q.ExecuteScalar();
	
		if (parseInt(discounts)==parseInt(1))
		{
			var q = new Query("SELECT Discount " +
				" FROM Document_Order_SKUs WHERE Ref=@ref LIMIT 1");
			q.AddParameter("ref", order);

			massDiscount = q.ExecuteScalar();
		}
	}
	return massDiscount;
}