// $(function(){
// 	var inputs = $('.input');
// 	var paras = $('.description-flex-container').find('p');
// 	$(inputs).click(function(){
// 		var t = $(this),
// 				ind = t.index(),
// 				matchedPara = $(paras).eq(ind);
		
// 		$(t).add(matchedPara).addClass('active');
// 		$(inputs).not(t).add($(paras).not(matchedPara)).removeClass('active');
// 	});
// });

$(document).ready(() => {

	$("#create-time").on("click",function(){
		$('.input-flex-container').append('<div class="input">'+
				'<span data-year="1960" data-info="call"></span>'+
			'</div>')
	})
	// var inputs = $('.input');
	// var paras = $('.description-flex-container').find('p');
	$('.input-flex-container').on('click','.input',function(){
		inputs = $('.input');
		var t = $(this);
		console.log(inputs)
		$(t).addClass('active');
		$(inputs).not(t).removeClass('active');
	});
});