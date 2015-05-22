function AddSnapshot(objectRef, valueRef, func, listChoice, objectType) {
//	if ($.sessionConst.galleryChoose)
		Dialog.Choose(Translate["#choose_action#"], listChoice, AddSnapshotHandler, [objectRef,func,valueRef,objectType]);
//	else{
//		var pictId = GetCameraObject(objectRef);
//		var path = GetPrivateImagePath("catalog.outlet", objectRef, pictId, ".jpg");
//		Camera.MakeSnapshot(path, 300, func, [ objectRef, pictId ]);
//	}		
}

function AddSnapshotHandler(state, args) {	
	var objRef = state[0];
	var func = state[1];
	var valueRef = state[2];
	var objectType = state[3];
	
	if (parseInt(args.Result)==parseInt(0)){	
		var pictId = GenerateGuid();				
		var path = GetPrivateImagePath(objectType, objRef, pictId, ".jpg");
		Gallery.Size = 300;
		Gallery.Copy(path, func, [objRef, pictId]);					
	}
	
	if (parseInt(args.Result)==parseInt(1)){
		var pictId = GetCameraObject(objRef);
		var path = GetPrivateImagePath(objectType, objRef, pictId, ".jpg");
		Camera.MakeSnapshot(path, 400, func, [ objRef, pictId]);
	}
	
	if (parseInt(args.Result)==parseInt(2)){
		if (valueRef.IsNew()){
			DB.Delete(valueRef);
			Workflow.Refresh([]);
		}
		else{
			var value = valueRef.GetObject();
			value.Value = "";
			value.Save();
			Workflow.Refresh([]);
		}
	}
}


function GetSharedImagePath(objectType, objectID, pictID, pictExt) {
	var r = "/shared/" + objectType + "/" + objectID.Id.ToString() + "/"
    + pictID + pictExt;
	return r;
}

function GetPrivateImagePath(objectType, objectID, pictID, pictExt) {
	var r = "/private/" + objectType + "/" + objectID.Id.ToString() + "/"
    + pictID + pictExt;
	return r;
}

function GetCameraObject(entity) {
	FileSystem.CreateDirectory("/private/Catalog.Outlet");
	var guid = Global.GenerateGuid();
	var path = String.Format("/private/Catalog.Outlet/{0}/{1}.jpg", entity.Id, guid);
	Camera.Size = 400;
	Camera.Path = path;
	return guid;
}

function GenerateGuid() {

    return (S4() + S4() + "-" + S4() + "-" + S4() + "-" + S4() + "-" + S4() + S4() + S4());
}

function S4() {
    return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
}
