/* Para quem é: cada cena só anima enquanto está visível. */
(function(){
 var section=document.querySelector('.pub');
 if(!section||!('IntersectionObserver' in window))return;
 var cards=section.querySelectorAll('.pub-card');
 var io=new IntersectionObserver(function(entries){
  entries.forEach(function(e){e.target.classList.toggle('pub-play',e.isIntersecting)});
 },{threshold:.3});
 cards.forEach(function(card){io.observe(card)});
 section.classList.add('pub-ready');
})();
