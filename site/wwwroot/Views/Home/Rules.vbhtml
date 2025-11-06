@Code
    ViewData("Title") = "Rules"
End Code

<div class="container">
    <div class="row">
      <div class="col">
        <div class="card">
            <div class="card-header">
              <h4>@ViewData("Title")</h4>
            </div>
            <div class="card-body">
            <section aria-labelledby="entry">
				<h3 id="entry">Entry</h3>
				<p><span class="pill">$25</span> - Each participant chips in a <span class="highlight">$25 entry fee</span> and will be <strong>randomly assigned</strong> to a team.</p>
			</section>


			<section aria-labelledby="rules" style="margin-top:12px">
				<h3 id="rules">The Game</h3>
				<ul>
					<li>Your fate is tied to your teammates - as long as <em>someone</em> from your team hasn’t been drawn, you’re still in the running for an equal share of the wine.</li>
					<li>A week before the party we start pulling names from the hat - <strong>50% of the names</strong> will be drawn before the big night.</li>
					<li>The remaining names will be drawn live throughout the evening, with the <strong>final name</strong> revealed around <strong>10:00 PM</strong>.</li>
					<li>The last name left in the drum represents the <strong>winning team</strong> - if one of your teammates is still standing, so are you.</li>
					<li>The winning team splits the wine amongst themselves.</li>
					<li>To keep things smooth (and drama-free), <strong>only the winners</strong> will pick the bottles.</li>
				</ul>
			</section>
            </div>
          </div>
        </div>
    </div>
</div>
