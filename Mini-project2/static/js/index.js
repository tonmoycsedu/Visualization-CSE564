$(document).ready(() => {

    var data_name;
    var data;
    var k;

    var attr1 = [], attr2= [], attr3 =[];
    var data1, data2, daat3;
    
   
	//function to read file and render the graph
	$('#file-upload').on('change', function(e) {
        console.log("dukhse")
		//check file length
	 	if (!e.target.files.length) return;  

            var file = e.target.files[0];
            data_name = file.name;

            var ext = data_name.split('.').pop();
            if (ext != "csv") {
                file_error("File format error");
            } 
            else {
				// read csv data          
            	var reader = new FileReader();
                reader.readAsText(file);  
                

                //send csv data to server using ajax
                reader.onload = function(event) {
                	//console.log(reader.result)
                        data = reader.result 
	            	  	$.ajax({
			            url: '/read_csv',
			            data: JSON.stringify({content:reader.result,name:data_name}),
			            //contentType: JSON,
			            type: 'POST',
			            success: function(response) {
			                
			                // on success load the modal with default type numerical
			                // insert_into_modal(response['attributes'])

			                // modal_submit(response['attributes'])
                            console.log(response['data'])
                            line_plot(response['data'])
			                		                    
			            },
			            //error function for first ajax call
			            error: function(error) {
			                console.log(error);
			            }
			        });
                }
          
            }
    });

    $('#go_button').on('click', function(e) {

        $.ajax({
            url: '/get_sample',
            data: JSON.stringify({content:data,k:k}),
            //contentType: JSON,
            type: 'POST',
            success: function(response) {
                
                // on success load the modal with default type numerical
                // insert_into_modal(response['attributes'])

                // modal_submit(response['attributes'])
                console.log(response['var1'])
                scree_plot(response['var1'],"scree-original", "Scree Plot on Original Dataset")
                scree_plot(response['var2'],"scree-random","Scree Plot on Random Dataset")
                scree_plot(response['var3'],"scree-stratified","Scree Plot on Stratified Dataset")

                scatter_plot(response['pc1'],"scatter-original", "Scatter Plot on Original Dataset", "PCA Component1", "PCA Component2")
                scatter_plot(response['pc2'],"scatter-random","Scatter Plot on Random Dataset", "PCA Component1", "PCA Component2")
                scatter_plot(response['pc3'],"scatter-stratified","Scatter Plot on Stratified Dataset", "PCA Component1", "PCA Component2")

                scatter_plot(response['mds1'],"mds-original", "Scatter Plot on Original Dataset","MDS Component1", "MDS Component2")
                scatter_plot(response['mds2'],"mds-random","Scatter Plot on Random Dataset","MDS Component1", "MDS Component2")
                scatter_plot(response['mds3'],"mds-stratified","Scatter Plot on Stratified Dataset","MDS Component1", "MDS Component2")

                create_table(response["loading_original"],response["loading_random"],response["loading_stratified"],response['columns'])
                //scatter_plot(response['data'])
                console.log(response["columns"])

                data1 = response['data1']
                data2 = response['data2']
                data3 = response['data3']

                console.log(data3)

                $("#home_container").hide()
                $("#graph_container1").show()
                $("#pagination").show();

                                            
            },
            //error function for first ajax call
            error: function(error) {
                console.log(error);
            }
        });



    });

    $("#pagination").on("click",function(){
        curr_sts = $("#pagination").html()
        if(curr_sts == "Next Page")
        {
            $("#graph_container1").hide();
            $("#pagination").html("Prev Page");
            $("#pca_loading").show()
            $( "#sc-matrix" ).prop( "disabled", false );

        }
        else
        {
            $("#graph_container1").show();
            $("#pagination").html("Next Page");
            $("#pca_loading").hide()
            $( "#sc-matrix" ).prop( "disabled", true );

        }

    });

    $('#loading_original').bind('click', function(e) {
        
        // console.log($(e.target).closest('tr').children('td')[0].innerHTML)
        if(attr1.length< 3)
        {
            attr1.push($(e.target).closest('tr').children('td')[0].innerHTML)
            $(e.target).closest('tr').children('td,th').css('background-color','#c1c5cc');
        }
        else
            alert("you have already selected three attributes")

        console.log(attr1)

        if(attr1.length == 3 && attr2.length == 3 && attr3.length == 3)
        {
            $("#sc-matrix").show()
        }

    });

    $('#loading_random').bind('click', function(e) {
        // $(e.target).closest('tr').children('td,th').css('background-color','#c1c5cc');
        if(attr2.length< 3)
        {
            attr2.push($(e.target).closest('tr').children('td')[0].innerHTML)
            $(e.target).closest('tr').children('td,th').css('background-color','#c1c5cc');
        }
        else
            alert("you have already selected three attributes")

        if(attr1.length == 3 && attr2.length == 3 && attr3.length == 3)
        {
            $("#sc-matrix").show()
        }
    });
    $('#loading_stratified').bind('click', function(e) {
        // $(e.target).closest('tr').children('td,th').css('background-color','#c1c5cc');
        if(attr3.length< 3)
        {
            attr3.push($(e.target).closest('tr').children('td')[0].innerHTML)
            $(e.target).closest('tr').children('td,th').css('background-color','#c1c5cc');
        }
        else
            alert("you have already selected three attributes")

        if(attr1.length == 3 && attr2.length == 3 && attr3.length == 3)
        {
            $("#sc-matrix").show()
        }
    });

    $("#sc-matrix").on("click",function(){
        $( "#sc-matrix" ).prop( "disabled", true );
        $("#scatter-mat").show();

        $.ajax({
            url: '/get_sc_matrix',
            data: JSON.stringify({data1:data1,data2:data2,data3:data3,attr1:attr1,attr2:attr2,attr3:attr3}),
            //contentType: JSON,
            type: 'POST',
            success: function(response) {
                // console.log(JSON.parse(response['data1']))
                scatter_matrix(JSON.parse(response['data1']),"scatter-mat-original")
                scatter_matrix(JSON.parse(response['data2']),"scatter-mat-random")
                scatter_matrix(JSON.parse(response['data3']),"scatter-mat-stratified")
            },
            //error function for first ajax call
            error: function(error) {
                console.log(error);
            }
        });

    });

    $("input[type=radio]").on("click",function(e){
        console.log($(this).val());
        opt = $(this).val()
        if(opt == "Original Dataset")
        {
            console.log("1")
            $("#scatter-mat-original").show();
            $("#scatter-mat-random").hide();
            $("#scatter-mat-stratified").hide();

        }
        else if(opt == "Random Dataset")
        {
            console.log("2")

            $("#scatter-mat-original").hide();
            $("#scatter-mat-random").show();
            $("#scatter-mat-stratified").hide();

        
        }
        else
        {
            console.log("3")
            $("#scatter-mat-original").hide();
            $("#scatter-mat-random").hide();
            $("#scatter-mat-stratified").show();

        }
    })

    function create_table(loading_original,loading_random,loading_stratified,columns)
    {
        var content1 = "", content2 = "", content3 = "";
        console.log(loading_original)
        console.log(loading_random)
        console.log(loading_stratified)
        for(i= 0; i< columns.length;i++){

            content1 += '<tr><td>'+columns[i]+'</td>';
            content2 += '<tr><td>'+columns[i]+'</td>';
            content3 += '<tr><td>'+columns[i]+'</td>';    

            for(j=0; j<loading_original.length; j++){
                
                content1 += '<td>'+loading_original[j][i].toFixed(4)+'</td>';
                content2 += '<td>'+loading_random[j][i].toFixed(4)+'</td>';
                content3 += '<td>'+loading_stratified[j][i].toFixed(4)+'</td>';

            }
            content1 += '</tr>'
            content2 += '</tr>'
            content3 += '</tr>'
        }

        $('#loading_original').append(content1);
        $('#loading_random').append(content2);
        $('#loading_stratified').append(content3);
    }

    function scatter_matrix(data,div_name)
    {
        var width = 900,
            size = 230,
            padding = 20;

        var x = d3.scaleLinear()
            .range([padding / 2, size - padding / 2]);

        var y = d3.scaleLinear()
            .range([size - padding / 2, padding / 2]);

        var xAxis = d3.axisBottom()
            .scale(x)
            .ticks(6);

        var yAxis = d3.axisLeft()
            .scale(y)
            .ticks(6);

        var color = d3.scaleOrdinal(d3.schemeCategory10);

        var domainByTrait = {},
              traits = d3.keys(data[0]),
              n = traits.length;

          traits.forEach(function(trait) {
            domainByTrait[trait] = d3.extent(data, function(d) { return d[trait]; });
          });

          xAxis.tickSize(size * n);
          yAxis.tickSize(-size * n);

        var brush = d3.brush()
              .on("start", brushstart)
              .on("brush", brushmove)
              .on("end", brushend)
              .extent([[0,0],[size,size]]);

          var svg = d3.select("#"+div_name).append("svg")
              .attr("width", size * n + padding)
              .attr("height", size * n + padding)
            .append("g")
              .attr("transform", "translate(" + padding + "," + padding / 2 + ")");

          svg.selectAll(".x.axis")
              .data(traits)
            .enter().append("g")
              .attr("class", "x axis")
              .attr("transform", function(d, i) { return "translate(" + (n - i - 1) * size + ",0)"; })
              .each(function(d) { x.domain(domainByTrait[d]); d3.select(this).call(xAxis); });

          svg.selectAll(".y.axis")
              .data(traits)
            .enter().append("g")
              .attr("class", "y axis")
              .attr("transform", function(d, i) { return "translate(0," + i * size + ")"; })
              .each(function(d) { y.domain(domainByTrait[d]); d3.select(this).call(yAxis); });

          var cell = svg.selectAll(".cell")
              .data(cross(traits, traits))
            .enter().append("g")
              .attr("class", "cell")
              .attr("transform", function(d) { return "translate(" + (n - d.i - 1) * size + "," + d.j * size + ")"; })
              .each(plot);

          // Titles for the diagonal.
          cell.filter(function(d) { return d.i === d.j; }).append("text")
              .attr("x", padding)
              .attr("y", padding)
              .attr("dy", ".71em")
              .text(function(d) { return d.x; });

          cell.call(brush);

          function plot(p) {
            var cell = d3.select(this);

            x.domain(domainByTrait[p.x]);
            y.domain(domainByTrait[p.y]);

            cell.append("rect")
                .attr("class", "frame")
                .attr("x", padding / 2)
                .attr("y", padding / 2)
                .attr("width", size - padding)
                .attr("height", size - padding);

            cell.selectAll("circle")
                .data(data)
              .enter().append("circle")
                .attr("cx", function(d) { return x(d[p.x]); })
                .attr("cy", function(d) { return y(d[p.y]); })
                .attr("r", 4)
                .style("fill", function(d) { return color(d.species); });
          }

          var brushCell;

          // Clear the previously-active brush, if any.
          function brushstart(p) {
            if (brushCell !== this) {
              d3.select(brushCell).call(brush.move, null);
              brushCell = this;
            x.domain(domainByTrait[p.x]);
            y.domain(domainByTrait[p.y]);
            }
          }

          // Highlight the selected circles.
          function brushmove(p) {
            var e = d3.brushSelection(this);
            svg.selectAll("circle").classed("hidden", function(d) {
              return !e
                ? false
                : (
                  e[0][0] > x(+d[p.x]) || x(+d[p.x]) > e[1][0]
                  || e[0][1] > y(+d[p.y]) || y(+d[p.y]) > e[1][1]
                );
            });
          }

          // If the brush is empty, select all circles.
          function brushend() {
            var e = d3.brushSelection(this);
            if (e === null) svg.selectAll(".hidden").classed("hidden", false);
          }
        

        function cross(a, b) {
          var c = [], n = a.length, m = b.length, i, j;
          for (i = -1; ++i < n;) for (j = -1; ++j < m;) c.push({x: a[i], i: i, y: b[j], j: j});
          return c;
        }



    }

    function scatter_plot(data,div_name,text,xLabel,yLabel)
    {
        // set the dimensions and margins of the graph
        var margin = {top: 20, right: 20, bottom: 30, left: 50},
            width = 500 - margin.left - margin.right,
            height = 300 - margin.top - margin.bottom;


        // set the ranges
        var x = d3.scaleLinear().range([0, width]);
        var y = d3.scaleLinear().range([height, 0]);


        // append the svg obgect to the body of the page
        // appends a 'group' element to 'svg'
        // moves the 'group' element to the top left margin
        var svg = d3.select("#"+div_name).append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
          .append("g")
            .attr("transform",
                  "translate(" + margin.left + "," + margin.top + ")");
        // Scale the range of the data
          x.domain([d3.min(data, function (d) {return d.x}), d3.max(data, function (d) {return d.x})]);
          y.domain([d3.min(data, function(d) { return d.y; }), d3.max(data, function(d) { return d.y; })]);

              
          // Add the scatterplot
          svg.selectAll("dot")
              .data(data)
            .enter().append("circle")
              .attr("r", 3)
              .attr("cx", function(d) { return x(d.x); })
              .attr("cy", function(d) { return y(d.y); })
              .attr('fill',"#4CAF50")

          // Add the X Axis
          svg.append("g")
              .attr("transform", "translate(0," + height + ")")
              .call(d3.axisBottom(x));

          // Add the Y Axis
          svg.append("g")
              .call(d3.axisLeft(y));

          svg.append("text")
          .attr("class", "title")
          .attr("x", width/2)
          .attr("y", 20+(margin.top))
          .attr("text-align", "center")
          .text(text);

          svg.append("text")             
              .attr("transform",
                    "translate(" + (width/2) + " ," + 
                                   (height + margin.top + 10) + ")")
              .style("text-anchor", "middle")
              .text(xLabel);

          // text label for the y axis
          svg.append("text")
              .attr("transform", "rotate(-90)")
              .attr("y", 0 - margin.left)
              .attr("x",0 - (height / 2))
              .attr("dy", "1em")
              .style("text-anchor", "middle")
              .text(yLabel);
    }

    function line_plot(data)
    {
        // set the dimensions and margins of the graph
        var margin = {top: 20, right: 20, bottom: 30, left: 50},
            width = 500 - margin.left - margin.right,
            height = 300 - margin.top - margin.bottom;


        // set the ranges
        var x = d3.scaleLinear().range([0, width]);
        var y = d3.scaleLinear().range([height, 0]);

        // define the line
        var valueline = d3.line()
            .x(function(d) { return x(d.index); })
            .y(function(d) { return y(d.error); });

        // append the svg obgect to the body of the page
        // appends a 'group' element to 'svg'
        // moves the 'group' element to the top left margin
        var svg = d3.select("#svg_div").append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
          .append("g")
            .attr("transform",
                  "translate(" + margin.left + "," + margin.top + ")");
        // Scale the range of the data
          x.domain([1, d3.max(data, function (d) {return d.index})+1]);
          y.domain([0, d3.max(data, function(d) { return d.error; })+2]);

          // Add the valueline path.
          svg.append("path")
              .data([data])
              .attr("class", "line")
              .attr("d", valueline);
              
          // Add the scatterplot
          svg.selectAll("dot")
              .data(data)
            .enter().append("circle")
              .attr("r", 5)
              .attr("cx", function(d) { return x(d.index); })
              .attr("cy", function(d) { return y(d.error); })
              .attr('fill',"#4CAF50")
              .on("mouseover", function(d) {
                $(this).attr("fill","orangered")
              })
              .on("click", function(d) {
                
                k = d.index
                console.log(k)
                $("#show-k").html(" <b>k="+d.index+'</b>')
                $("#show-k").val(d.index)
                $( "#go_button" ).prop( "disabled", false );
              })
              .on("mouseout", function(d) {
                $(this).attr("fill","#4CAF50")
              });

          // Add the X Axis
          svg.append("g")
              .attr("transform", "translate(0," + height + ")")
              .call(d3.axisBottom(x));

          // Add the Y Axis
          svg.append("g")
              .call(d3.axisLeft(y));

          //text labels for x axis
          // svg.append("text")             
          //     .attr("transform",
          //           "translate(" + (width/2) + " ," + 
          //                          (height + margin.top + 10) + ")")
          //     .style("text-anchor", "middle")
          //     .text("K");

          // text label for the y axis
          svg.append("text")
              .attr("transform", "rotate(-90)")
              .attr("y", 0 - margin.left)
              .attr("x",0 - (height / 2))
              .attr("dy", "1em")
              .style("text-anchor", "middle")
              .text("Sum of Squared Error");

          $("#text_div").show()
          

          $( "#go_button" ).prop( "disabled", true );
    }

    function scree_plot(data,div_name,text)
    {
        // set the dimensions and margins of the graph
        var margin = {top: 20, right: 20, bottom: 30, left: 40},
              width = 500 - margin.left - margin.right,
              height = 300 - margin.top - margin.bottom;
              radius = Math.min(width, height) / 2;

          // set the ranges
          var x = d3.scaleBand()
                    .range([0, width])
                    .padding(0.1);
          var y = d3.scaleLinear()
                    .range([height, 0]);
                    
          // append the svg object to the body of the page
          // append a 'group' element to 'svg'
          // moves the 'group' element to the top left margin
          var svg=d3.select("#"+div_name).append("svg")
              .attr("width", width + margin.left + margin.right)
              .attr("height", height + margin.top + margin.bottom)
            .append("g")
              .attr("transform", 
                    "translate(" + margin.left + "," + margin.top + ")");


        x.domain(data.map(function(d) { return d.index; }));
        y.domain([0, 1]);

        // define the line
        var valueline = d3.line()
            .x(function(d) { return x(d.index)+x.bandwidth()/2; })
            .y(function(d) { return y(d.com_sum); });


        svg.append("path")
              .data([data])
              .attr("class", "line")
              .attr("d", valueline);

        // append the rectangles for the bar chart
        svg.selectAll(".bar")
            .data(data)
          .enter().append("rect")
            .attr("class", "bar")
            .attr("x", function(d) { return x(d.index); })
            .attr("width", x.bandwidth())
            .attr("y", function(d) { return y(d.explained_variance); })
            .attr("height", function(d) { return height - y(d.explained_variance); });


        // Add the scatterplot
        svg.selectAll("dot")
              .data(data)
            .enter().append("circle")
              .attr("r", 5)
              .attr("cx", function(d) { return x(d.index)+x.bandwidth()/2; })
              .attr("cy", function(d) { return y(d.com_sum); })
              .attr('fill',"orangered")

        $(".line").css("stroke","orangered")

        svg.append("text")
          .attr("class", "title")
          .attr("x", width/2)
          .attr("y", 20+(margin.top))
          .attr("text-align", "center")
          .text(text);


        //text labels for x axis
          svg.append("text")             
              .attr("transform",
                    "translate(" + (width/2) + " ," + 
                                   (height + margin.top + 10) + ")")
              .style("text-anchor", "middle")
              .text("PCA Component");

          // text label for the y axis
          svg.append("text")
              .attr("transform", "rotate(-90)")
              .attr("y", 0 - margin.left)
              .attr("x",0 - (height / 2))
              .attr("dy", "1em")
              .style("text-anchor", "middle")
              .text("Explained Variance");
            
            

        // add the x Axis
        svg.append("g")
            .attr("transform", "translate(0," + height + ")")
            .call(d3.axisBottom(x));

        // add the y Axis
        svg.append("g")
            .call(d3.axisLeft(y));

    }
    

});