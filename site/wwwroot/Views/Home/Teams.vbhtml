@Code
    ViewData("Title") = "Teams"
    Dim teams = WineDraw.Foundation.TeamCollection.FetchTeams
End Code

	<script>
		function teamSearch() {
		try{
		  // Declare variables
		  var input, filter, ul, li, a, i, txtValue;
		  input = document.getElementById('searchBox');
		  filter = input.value.toUpperCase();
		  
		  row = document.getElementById("teamList");
		  cols = row.getElementsByClassName('col');

		  // Loop through all list items, and hide those who don't match the search query
		  for (i = 0; i < cols.length; i++) {
			var show=false;
			if (filter.length < 1){
				cols[i].style.display = "";
			}
			else {
				var tr = cols[i].getElementsByTagName("tr");
				for (row = 0; row < tr.length; row++){
					var name=tr[row].getElementsByTagName("td")[1];
					var txtValue=name.textContent||name.innerText;
					if (txtValue.toUpperCase().indexOf(filter) > -1) { 
						show=true;
					}
				}
				
				if (show) {
				  cols[i].style.display = "";
				} else {
				  cols[i].style.display = "none";
				}
			}
			
		  }
	  }
	  catch(ex){
		console.log(ex.message);
	  }
	}
	</script>
    <div class="container">
        <div class="row">
            <div class="col-lg-12 text-center">
                <div class="intro-text">
                    <h2>@ViewData("Title")</h2>
                    <hr class="star-primary">
                </div>
            </div>
        </div>
		<div class="row"><input type="text" id="searchBox" onkeyup="teamSearch()" placeholder="Search..." style="color: black;margin: 10px;"></div>
        <div class="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-4" id="teamList">
            @For Each t As WineDraw.Foundation.Team In teams
                @<div class="col">
					<div class="card">
                        <div class="card-header">
							@If t.IsEliminated Then
                                @<h4 class="card-title text-danger">Team @t.TeamNum</h4>
                            Else
                                @<h4 class="card-title">Team @t.TeamNum</h4>
                            End If
                        </div>
                        <div class="card-body">
                          <div class="table-responsive card-text">
                              <table class="table mb-0">
                                  @For Each p As WineDraw.Foundation.Player In t.Players
                                    If p.isElim Then
                                      @<tr>
                                          <td class="text-danger">@p.Id</td>
                                          <td class="text-danger">@p.Name</td>
                                          <td class="text-danger">@p.elimDateStr</td>
                                        </tr>
                                    Else
                                        @<tr>
                                          <td>@p.Id</td>
                                          <td>@p.Name</td>
                                          <td>@p.elimDateStr</td>
                                        </tr>
                                    End If
                                  Next
                              </table>
                          </div>
                    </div>
                </div>
		</div>
            Next
        </div>
    </div>
