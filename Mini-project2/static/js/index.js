$(document).ready(() => {

    var data_name;
    var data;
    var k;

    
    function scatter_plot(data)
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
            
            

        // add the x Axis
        svg.append("g")
            .attr("transform", "translate(0," + height + ")")
            .call(d3.axisBottom(x));

        // add the y Axis
        svg.append("g")
            .call(d3.axisLeft(y));

    }
    
   
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
                            scatter_plot(response['data'])
			                		                    
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
                //scatter_plot(response['data'])
                console.log("shshdjshj")
                                            
            },
            //error function for first ajax call
            error: function(error) {
                console.log(error);
            }
        });
        $("#home_container").hide()
        $("#graph_container").show()


    });
    

});