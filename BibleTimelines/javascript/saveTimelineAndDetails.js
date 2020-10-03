//PART OF THE HTML DOVUMNT TO SAVE
//TO CREATE FILE TO SAVE
function saveDynamicDataToFile() {

	var saveText = `---
layout: bibleStoryLineTEMPLATE
title: "` + storyLineTableTitleHeader.innerHTML + `"
categories: Timeline
---
<style id="divColorStyles">` +
		divColorStyles.innerHTML +
		`</style>
{% include BStL-preStorylineTable.html %}
<table id="storyLineTable">` +
		storyLineTable.innerHTML +
		`</table>

{% include BStL-masterTableEND.html %}
{% include BStL-detailsSection-Buttons.html %}

	<div id="detailsSummary" class="scrollbar-custom">` +
		detailsSummary.innerHTML;

	//console.log(saveText);

	////////////////////////////////////////////////////////////////////////////////////////////
	//REMOVE THE MODIFICATION ADDED BY REFTAGGER BEFORE SAVING
	//This is useful for when you make a correction in a Bible reference or else it would still link to the old reference.
	saveText.toString();
	saveText = saveText.replace(/(<a class="rtBibleRef"([^>]+)>)(\w+\s+\d+:\d+)(<\/a>)/g, "$3");
	//console.log(saveText);
	////////////////////////////////////////////////////////////////////////////////////////////

	var fname = storyLineTableTitleHeader.innerHTML;
	if (fname == "") {
		customAlert("!!! PLEASE <h1>ENTER TITLE</h1> FOR THE STORY LINE !!!");
		return false;
	} else {

		var filename = fname + `.html`;

		var blob = new Blob([saveText], {
			type: "text/plain;charset=utf-8"
		});
		saveAs(blob, filename);
	}
}
