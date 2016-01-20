
function GetCurrentTask(){
	return GlobalWorkflow.GetCurrentTask();
}

function FormatDate(datetime) {

	Console.WriteLine(datetime);

	if (String.IsNullOrEmpty(datetime))
		return Translate["#notLimited#"];
	else if (datetime == "01.01.0001 0:00:00")
		return Translate["#notLimited#"];
	else
		return Format("{0:d}", Date(datetime).Date);
}

function RetrieveTask(task){
	var taskObj = task.GetObject();
	taskObj.Status = false;
	taskObj.ExecutionDate = null;
	taskObj.FactExecutor = DB.EmptyRef("Catalog_User");
	taskObj.Result = $.result.Text;
	taskObj.Save();
	DoRefresh();
}

function CompleteTheTask(task){
	var taskObj = task.GetObject();
	taskObj.Status = true;
	taskObj.ExecutionDate = DateTime.Now;
	taskObj.FactExecutor = $.common.UserRef;
	taskObj.Result = $.result.Text;
	taskObj.Save();
	DoRefresh();
}

function CompleteTask(){
	if ($.workflow.name == 'Visit'){
		GlobalWorkflow.SetCurrentTask(null);
		DoBack();
	}
	else
		DoCommit();
}

function IsEditable(task){
	var q = new Query("SELECT IsDirty FROM Document_Task WHERE Id=@task");
	q.AddParameter("task", task);
	var isDirty = q.ExecuteScalar();
	return (!task.Status || parseInt(isDirty)==parseInt(1)) && ($.sessionConst.editTasksWithoutVisit || $.workflow.name=="Visit");
}

function SaveComment(control, task){
	var taskObj = task.GetObject();
	taskObj.Result = control.Text;
	taskObj.Save();
}
