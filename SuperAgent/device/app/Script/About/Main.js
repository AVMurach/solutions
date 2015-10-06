
function SendLog(){
	// $.sendButton.Visible = false;
	// $.dataSyncLayout.Visible = true;
	// $.dataSyncIndicator.Start();

	var result = Application.SendDatabase();

	// $.sendButton.Visible = true;
	// $.dataSyncLayout.Visible = false;
	// $.dataSyncIndicator.Stop();	

	if (result)
		Dialog.Message(Translate["#success#"]);
	else
		Dialog.Message(Translate["#noSuccess#"]);
}