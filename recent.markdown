---
layout: default
---

<div class="container body-content">
    <div class="row">
        <div class="col-lg-12 text-center">
            <div class="intro-text">
                <h2>Recently Eliminated</h2>
                <hr class="star-primary">
            </div>
        </div>
    </div>
    <iframe id="myiframe" src="https://script.google.com/a/macros/pixiesparties.ca/s/{{ site.google_apps_script_id }}/exec?page=recent" width="100%" height="16000px" frameborder="0" style="border: 0px solid #eee; border-radius: 0px; "></iframe>
</div>
<script>
    //debugger;
    // In the parent window
    window.addEventListener('message', function (event) {
        // Check event.origin for security if not using '*' in postMessage
        if (event.data.height) {
            var iframe = document.getElementById("myiframe");
            var maxHeight = 1200; // Define your maximum height in pixels

            if (event.data.height > maxHeight) {
                iframe.height = maxHeight + "px";
                iframe.style.overflowY = "scroll";
            } else {
                iframe.height = event.data.height + "px";
            }
        }
    });
</script>