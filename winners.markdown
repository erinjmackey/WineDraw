---
layout: default
---

<div class="container body-content">
<div class="container">
    <div class="row">
        <div class="col-lg-12 text-center">
            <div class="intro-text">
                <h2>Previous Winners</h2>
                <hr class="star-primary">
            </div>
        </div>
    </div>
    <div class="row">
        {% for post in site.data.winners %}
        <div class="col col-md-3">
            <div class="card ">
                <div class="card-header">
                    {{ post.year }}
                </div>
                <div class="card-body">
                    <p>
                        {% for member in post.members %}
                        {{ member }}  <br>
                        {% endfor %}
                    </p>
                </div>
            </div>
        </div>
        {% endfor %}
    </div>
</div>