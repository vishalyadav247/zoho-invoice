let registrationbtn = document.querySelector('.banner-btn-box');
let customer = JSON.parse(localStorage.getItem('customer'));
if(!customer){
    if (registrationbtn) registrationbtn.style.display = 'flex';
}
