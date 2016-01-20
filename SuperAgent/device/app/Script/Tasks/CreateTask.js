
var task;
var requiredLeft;

function GetTask(){
	task = GlobalWorkflow.GetCurrentTask();

	if (task == null)
		CreateNewTask();

	return task;

	requiredLeft = parseInt(0);
}

function CreateNewTask(){
	var taskObj = DB.Create("Document.Task");
	taskObj.Date = DateTime.Now;
	taskObj.CreatedAtMA = true;
	taskObj.Responsible = $.common.UserRef;
	taskObj.PlanExecutor = $.common.UserRef;
	taskObj.Status = false;	
	if ($.workflow.name=="Visit")
		taskObj.Outlet = GlobalWorkflow.GetOutlet();
	taskObj.Save();

	task = taskObj.Id;

	GlobalWorkflow.SetCurrentTask(task);
}

function SetSideStyles(){
	var sideStyle = new Dictionary();

	var taskRef = task.GetObject();

	requiredLeft = parseInt(0);	

	// sideStyle.Add("startPlanDate", ClassValue(taskRef.StartPlanDate));
	// sideStyle.Add("endPlanDate", ClassValue(taskRef.EndPlanDate));
	sideStyle.Add("outlet", ClassValue(taskRef.Outlet));
	sideStyle.Add("textTask", ClassValue(taskRef.TextTask));

	return sideStyle;
}

function ClassValue(value)
{
	requiredLeft = typeof requiredLeft == "undefined" ? parseInt(0) : requiredLeft;

	if (String.IsNullOrEmpty(value) || value=="—" || value == DB.EmptyRef("Catalog.Outlet"))
	{
		requiredLeft = requiredLeft + 1;
		return "required_side_wh";
	}
	else
		return "answered_side_wh";
}

function NoRequired()
{
	return parseInt(requiredLeft) == parseInt(0);
}

function FormatRef(value){
	return value == DB.EmptyRef("Catalog.Outlet") ? "—" : value.Description;
}

function FormatDate(datetime) {
	return String.IsNullOrEmpty(datetime) ? "—" : Format("{0:d}", Date(datetime).Date);
}

function SelectDateTime(sender, attr, title){
	Dialogs.ChooseDateTime(task, attr, sender, CallBack, title);
}

function CallBack(state, args){ //call back for dates only

	var task = state[0];
	var attr = state[1];

	var ranged;

	if (attr == "StartPlanDate" && !String.IsNullOrEmpty(task.EndPlanDate)){
		ranged = Date(task.EndPlanDate).Date >= Date(args.Result).Date;
	}
	else if (attr == "EndPlanDate" && !String.IsNullOrEmpty(task.StartPlanDate)){
		ranged = Date(task.StartPlanDate).Date <= Date(args.Result).Date;
	}
	else
		ranged = true;


	if (ranged){
		if (attr == "StartPlanDate" && Date(args.Result).Date < Date(DateTime.Now).Date)
			Dialog.Message(Translate["#lessToday#"]);
		else
			AssignDialogValue(state, args);
			Workflow.Refresh([]);
	}
	else
		Dialog.Message(Translate["#lessStart#"]);

}

function SaveAndRefresh(sender){
	var taskObj = task.GetObject();
	taskObj.TextTask = sender.Text;
	taskObj.Save();
	Workflow.Refresh([]);
}

function CompleteTask(){
	GlobalWorkflow.SetCurrentTask(null);
	if ($.workflow.name == 'Visit')
		DoBack();
	else
		DoCommit();
}

function RollbackTask(task){
	GlobalWorkflow.SetCurrentTask(null);
	if ($.workflow.name == 'Visit'){
		DB.Delete(task);		
		DoBack();
	}
	else
		DoRollback();
}