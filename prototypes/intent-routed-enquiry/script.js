(() => {
  const bank = {
    system: {
      home: [['Lights','bulbs'],['Fridge','refrigerator'],['Freezer','deep freezer'],['TV','television'],['Wi-Fi router','internet'],['Phone charging','phones'],['Laptop','computer'],['Washing machine','washer'],['Water pump','borehole pump'],['Microwave','oven'],['Electric cooker','stove'],['Air conditioner','ac'],['CCTV cameras','security']],
      office: [['Lights','lighting'],['Desktop computers','pc'],['Laptops','notebooks'],['Wi-Fi router','internet'],['Printer','printing'],['Photocopier','copier'],['Server equipment','server'],['Air conditioner','ac'],['CCTV cameras','security'],['POS system','till'],['Fridge','refrigerator']],
      farm: [['Water pump','borehole pump'],['Irrigation pump','irrigation'],['Lights','lighting'],['Electric fence','fencing'],['CCTV cameras','security'],['Cold room','cold storage'],['Freezer','deep freezer'],['Milking machine','dairy'],['Poultry equipment','incubator'],['Wi-Fi router','internet']]
    },
    equipment: [['Solar panels','pv modules'],['Solar battery','lithium battery, storage'],['Inverter','hybrid inverter, backup'],['Charge controller','mppt, pwm'],['Solar water heater','hot water'],['Solar water pump','borehole pump'],['Solar lighting kit','lights'],['Solar TV kit','television'],['Mounting and cables','brackets, wiring']]
  };
  const routes = {
    system: ['intent','property','items','contact'],
    equipment: ['intent','items','contact'],
    service: ['intent','serviceType','description','contact'],
    survey: ['intent','surveyFor','contact'],
    unsure: ['intent','description','contact']
  };
  const routeNames = {system:'Solar system',equipment:'Solar equipment',service:'Existing-system service',survey:'Site assessment',unsure:'General enquiry'};
  const serviceNames = {repair:'Repair or troubleshoot',maintenance:'Maintenance',upgrade:'Upgrade or expand',reinstallation:'Remove and reinstall'};
  const surveyNames = {new:'a new installation',upgrade:'an existing system upgrade',project:'a business or farm project',unknown:'an undecided project'};
  const state = {route:null,property:null,items:[],install:false,serviceType:null,surveyFor:null,description:'',location:'',name:'',phone:''};
  const $ = id => document.getElementById(id);
  const wizard = $('wizard');
  const content = $('question-content');
  const shell = $('question-shell');
  let index = 0;
  let navigating = false;
  let suggestions = [];
  let activeIndex = -1;
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const path = () => routes[state.route] || ['intent'];
  const current = () => path()[index];
  const norm = value => value.trim().replace(/\s+/g,' ').toLocaleLowerCase();
  const exists = name => state.items.some(item => norm(item.name) === norm(name));
  const catalog = () => state.route === 'system' ? bank.system[state.property || 'home'] : bank.equipment;

  function node(tag,className,text) {
    const el=document.createElement(tag);
    if(className)el.className=className;
    if(text!==undefined)el.textContent=text;
    return el;
  }
  function setQuestion(kicker,title,hint) {
    $('step-kicker').textContent=kicker;
    $('question-title').textContent=title;
    $('question-hint').textContent=hint;
    $('question-error').hidden=true;
    content.replaceChildren();
  }
  function showError(message) {
    $('question-error').textContent=message;
    $('question-error').hidden=false;
  }
  function option(icon,title,subtitle,chosen,onClick) {
    const button=node('button',`option${chosen?' selected':''}`);
    button.type='button';
    button.setAttribute('aria-label',`${title}. ${subtitle}${chosen?' Currently selected.':''}`);
    const symbol=node('span','option-icon',icon);symbol.setAttribute('aria-hidden','true');
    const text=node('span','option-text');text.append(node('strong','',title),node('small','',subtitle));
    const arrow=node('span','option-arrow','→');arrow.setAttribute('aria-hidden','true');
    button.append(symbol,text,arrow);button.addEventListener('click',onClick);return button;
  }
  function chooseRoute(route) {
    if(state.route!==route){state.items=[];state.property=null;state.serviceType=null;state.surveyFor=null;state.description='';state.install=false;}
    state.route=route;move(1);
  }
  function renderIntent() {
    setQuestion('START WITH YOUR GOAL','What do you need help with?','Pick the closest option. The next questions will match your request.');
    const list=node('div','option-list intent-list');
    list.append(
      option('☀','Get a solar system','A package sized for what I use.',state.route==='system',()=>chooseRoute('system')),
      option('▣','Buy solar equipment','Panels, batteries, inverters and more.',state.route==='equipment',()=>chooseRoute('equipment')),
      option('⚙','Service an existing system','Repair, maintain, upgrade or reinstall.',state.route==='service',()=>chooseRoute('service')),
      option('⌖','Request a site assessment','Have a site reviewed for a quotation.',state.route==='survey',()=>chooseRoute('survey'))
    );
    const unsure=node('button','unsure-link','I’m not sure what I need  →');unsure.type='button';unsure.addEventListener('click',()=>chooseRoute('unsure'));
    content.append(list,unsure);
  }
  function renderProperty() {
    setQuestion('YOUR SETTING','Where will the system be used?','Choose one so we can suggest relevant devices.');
    const list=node('div','option-list');
    [['⌂','At home','Household power','home'],['▣','At my business','Office or commercial use','office'],['♧','On a farm','Pumps and farm equipment','farm']].forEach(([icon,title,subtitle,value])=>list.append(option(icon,title,subtitle,state.property===value,()=>{if(state.property!==value)state.items=[];state.property=value;move(index+1);})));content.append(list);
  }
  function renderServiceType() {
    setQuestion('EXISTING SYSTEM','What needs doing?','Choose the closest description. You can explain more next.');
    const list=node('div','option-list compact-list');
    [['⌁','Repair or troubleshoot','Something is not working','repair'],['✧','Maintenance','Check or service an existing system','maintenance'],['↑','Upgrade or expand','Add capacity or replace components','upgrade'],['↗','Remove and reinstall','Move a system to another site','reinstallation']].forEach(([icon,title,subtitle,value])=>list.append(option(icon,title,subtitle,state.serviceType===value,()=>{state.serviceType=value;move(index+1);})));content.append(list);
  }
  function renderSurveyFor() {
    setQuestion('SITE ASSESSMENT','What should we assess?','This is a request for the team to discuss a site visit and quotation with you.');
    const list=node('div','option-list');
    [['☀','A new installation','Review a site for a new solar system','new'],['↑','An existing system','Check whether it can be upgraded','upgrade'],['▣','A business or farm project','Discuss a larger or specialized site','project'],['?','I’m not sure yet','Help me work out the scope','unknown']].forEach(([icon,title,subtitle,value])=>list.append(option(icon,title,subtitle,state.surveyFor===value,()=>{state.surveyFor=value;move(index+1);})));content.append(list);
  }
  function updateSelected() {
    const list=$('selected-list');list.replaceChildren();
    state.items.forEach(item=>{
      const row=node('div','selected-item');row.append(node('strong','',item.name));
      const remove=node('button','','×');remove.type='button';remove.setAttribute('aria-label',`Remove ${item.name}`);
      remove.addEventListener('click',()=>{state.items.splice(state.items.indexOf(item),1);updateSelected();updateQuickPicks();$('item-search').focus();});
      row.append(remove);list.append(row);
    });
    $('next-hint').textContent=state.items.length?`${state.items.length} item${state.items.length===1?'':'s'} added`:'Add at least one item';
    if(state.items.length)$('question-error').hidden=true;
  }
  function addItem(name) {
    const clean=name.trim().replace(/\s+/g,' ');if(clean.length<2||clean.length>50)return;
    if(!exists(clean))state.items.push({name:clean});
    $('item-search').value='';closeSuggestions();updateSelected();updateQuickPicks();$('item-search').focus();
  }
  function updateQuickPicks() {
    const box=$('quick-picks');box.replaceChildren();
    catalog().slice(0,5).forEach(([name])=>{if(exists(name))return;const button=node('button','',`+ ${name}`);button.type='button';button.setAttribute('aria-label',`Add ${name}`);button.addEventListener('click',()=>addItem(name));box.append(button);});
  }
  function closeSuggestions() {
    const popup=$('suggestions');if(!popup)return;popup.hidden=true;popup.replaceChildren();$('item-search').setAttribute('aria-expanded','false');$('item-search').removeAttribute('aria-activedescendant');activeIndex=-1;
  }
  function setActive(i) {
    activeIndex=i;[...$('suggestions').children].forEach((child,n)=>child.setAttribute('aria-selected',String(n===i)));
    if(i>=0){$('item-search').setAttribute('aria-activedescendant',`suggestion-${i}`);$('suggestions').children[i].scrollIntoView({block:'nearest'});}else $('item-search').removeAttribute('aria-activedescendant');
  }
  function updateSuggestions() {
    const search=$('item-search'),popup=$('suggestions'),query=norm(search.value);if(!query)return closeSuggestions();
    suggestions=catalog().filter(([name,aliases])=>!exists(name)&&norm(`${name} ${aliases}`).includes(query)).slice(0,6).map(([name])=>({name,custom:false}));
    if(query.length>=2&&!exists(query)&&!catalog().some(([name])=>norm(name)===query))suggestions.push({name:search.value.trim(),custom:true});
    popup.replaceChildren();suggestions.forEach((item,i)=>{
      const button=node('button','suggestion');button.type='button';button.id=`suggestion-${i}`;button.setAttribute('role','option');button.setAttribute('aria-selected','false');
      button.append(node('span','',item.custom?`Add “${item.name}”`:item.name),node('small','',item.custom?'Your own item':'Suggested'));
      button.addEventListener('mousedown',event=>event.preventDefault());button.addEventListener('click',()=>addItem(item.name));popup.append(button);
    });popup.hidden=!suggestions.length;search.setAttribute('aria-expanded',String(Boolean(suggestions.length)));activeIndex=-1;
  }
  function renderItems() {
    const system=state.route==='system';
    setQuestion(system?'SIZE YOUR SYSTEM':'FIND EQUIPMENT',system?'What do you need to power?':'Which equipment do you need?',system?'Add the devices you use. We can confirm the details later.':'Search for what you want to buy. If you do not know the exact name, type it in your own words.');
    const wrap=node('div','device-search-wrap');const search=node('input');search.id='item-search';search.type='text';search.autocomplete='off';search.placeholder=system?'Search fridge, lights, water pump…':'Search battery, panel, inverter…';search.setAttribute('role','combobox');search.setAttribute('aria-label',system?'Search devices you use':'Search solar equipment');search.setAttribute('aria-autocomplete','list');search.setAttribute('aria-expanded','false');search.setAttribute('aria-controls','suggestions');
    const popup=node('div','suggestions');popup.id='suggestions';popup.setAttribute('role','listbox');popup.hidden=true;wrap.append(search,popup);
    const quick=node('div','quick-picks');quick.id='quick-picks';const selected=node('div','selected-list');selected.id='selected-list';selected.setAttribute('aria-live','polite');
    content.append(wrap,node('p','quick-label',system?'COMMON DEVICES':'POPULAR EQUIPMENT'),quick,selected);
    if(!system){const label=node('label','install-toggle');const checkbox=node('input');checkbox.type='checkbox';checkbox.checked=state.install;checkbox.addEventListener('change',()=>{state.install=checkbox.checked;});label.append(checkbox,node('span','','I also need installation help'));content.append(label);}
    search.addEventListener('input',updateSuggestions);
    search.addEventListener('keydown',event=>{if(event.key==='ArrowDown'&&!popup.hidden){event.preventDefault();setActive((activeIndex+1)%suggestions.length);}if(event.key==='ArrowUp'&&!popup.hidden){event.preventDefault();setActive((activeIndex-1+suggestions.length)%suggestions.length);}if(event.key==='Escape'){closeSuggestions();event.stopPropagation();}if(event.key==='Enter'){event.preventDefault();if(activeIndex>=0)addItem(suggestions[activeIndex].name);else if(search.value.trim().length>=2)addItem(search.value);}});
    search.addEventListener('blur',()=>setTimeout(closeSuggestions,120));updateQuickPicks();updateSelected();
  }
  function renderDescription() {
    const service=state.route==='service';
    setQuestion(service?'TELL US A LITTLE MORE':'IN YOUR OWN WORDS',service?'What is happening with the system?':'What would you like help with?',service?'A short description is enough. You can tell us more when we speak.':'No technical terms needed. Tell us what you are trying to solve.');
    const wrap=node('div','form-field');const label=node('label','','Your description');label.htmlFor='description';const input=node('textarea','description-input');input.id='description';input.name='description';input.rows=5;input.maxLength=500;input.placeholder=service?'e.g. The inverter has stopped charging the battery':'e.g. I have frequent blackouts and need advice';input.value=state.description;input.addEventListener('input',()=>{state.description=input.value;$('question-error').hidden=true;});wrap.append(label,input,node('p','small-help','A sentence or two is enough.'));content.append(wrap);
  }
  function summary() {
    if(state.route==='system'||state.route==='equipment')return `${state.items.map(item=>item.name).join(', ')}${state.route==='equipment'&&state.install?' · Installation help requested':''}`;
    if(state.route==='service')return `${serviceNames[state.serviceType]||'Service'} · ${state.description}`;
    if(state.route==='survey')return `Assessment for ${surveyNames[state.surveyFor]||'a site'}`;
    return state.description;
  }
  function renderContact() {
    setQuestion('ONE LAST STEP','How can we reach you?','Your browser may offer saved details. Please check them before continuing.');
    const form=node('form','contact-form');form.id='contact-form';form.noValidate=true;form.autocomplete='on';
    const fields=[
      ['name','Full name','text','name','Your full name'],
      ['phone','Phone number','tel','tel','e.g. 0712 345 678'],
      ['location','Town or area','text','address-level2','e.g. Karen, Nairobi']
    ];
    fields.forEach(([key,title,type,autocomplete,placeholder])=>{
      const wrap=node('div','form-field');const label=node('label','',title);label.htmlFor=key;
      const input=node('input');input.id=key;input.name=key;input.type=type;input.autocomplete=autocomplete;input.placeholder=placeholder;input.required=true;input.value=state[key];
      if(key==='phone')input.inputMode='tel';
      input.addEventListener('input',()=>{state[key]=input.value;input.removeAttribute('aria-invalid');wrap.querySelector('.field-error')?.remove();$('question-error').hidden=true;});
      wrap.append(label,input);form.append(wrap);
    });
    form.addEventListener('submit',event=>{event.preventDefault();advance();});
    const review=node('div','review-line');review.append(node('b','',`${routeNames[state.route]}: `),document.createTextNode(summary()));
    content.append(form,review);
  }
  function renderComplete() {
    setQuestion('PROTOTYPE COMPLETE','That’s the whole enquiry.','');const wrap=node('div','complete');wrap.append(node('div','complete-icon','✓'),node('p','','A real submission would now send your request to Nucho Solar. This prototype has not sent or saved your information.'));const again=node('button','primary-button','Try another request');again.type='button';again.addEventListener('click',()=>{Object.assign(state,{route:null,property:null,items:[],install:false,serviceType:null,surveyFor:null,description:'',location:'',name:'',phone:''});move(0);});wrap.append(again);content.append(wrap);
  }
  function paint() {
    const total=path().length,done=index>=total;
    $('step-number').textContent=done?'Complete':state.route?`${index+1} of ${total}`:'Choose request';
    const percent=done?100:Math.round(index/total*100);
    document.querySelector('.progress').setAttribute('aria-valuenow',String(percent));$('progress-fill').style.width=`${percent}%`;
    $('back').hidden=index===0||done;$('next').hidden=done||['intent','property','serviceType','surveyFor'].includes(current());$('next-hint').hidden=done;
    document.querySelector('.wizard-footer').hidden=done;
    $('next').innerHTML=index===total-1?'Preview confirmation <span aria-hidden="true">→</span>':'Continue <span aria-hidden="true">→</span>';
    $('next').type=current()==='contact'?'submit':'button';if(current()==='contact')$('next').setAttribute('form','contact-form');else $('next').removeAttribute('form');
    $('next-hint').textContent=['intent','property','serviceType','surveyFor'].includes(current())?'Tap a choice to continue':'';
    if(done)renderComplete();else if(current()==='intent')renderIntent();else if(current()==='property')renderProperty();else if(current()==='items')renderItems();else if(current()==='serviceType')renderServiceType();else if(current()==='surveyFor')renderSurveyFor();else if(current()==='description')renderDescription();else renderContact();
    $('wizard-stage').scrollTop=0;const focusTarget=content.querySelector('input,textarea,button');if(focusTarget)focusTarget.focus({preventScroll:true});
  }
  function move(next) {
    if(navigating)return;navigating=true;const apply=()=>{index=next;shell.classList.remove('is-leaving');paint();navigating=false;};
    if(reducedMotion())apply();else{shell.classList.add('is-leaving');setTimeout(apply,160);}
  }
  function advance() {
    const key=current();
    if(key==='items'){if(!state.items.length){showError('Add at least one item to continue.');$('item-search').focus();return;}}
    if(key==='description'){state.description=$('description').value.trim();if(state.description.length<5){showError('Please add a short description.');$('description').focus();return;}}
    if(key==='contact'){
      for(const field of ['name','phone','location'])state[field]=$(field).value.trim();
      const digits=state.phone.replace(/\D/g,'');
      const invalid=state.name.length<2?['name','Please enter your name.']:digits.length<9||digits.length>15?['phone','Enter a valid phone number.']:state.location.length<2?['location','Please enter your town or area.']:null;
      if(invalid){const input=$(invalid[0]);input.setAttribute('aria-invalid','true');input.parentElement.querySelector('.field-error')?.remove();input.parentElement.append(node('p','field-error',invalid[1]));input.focus();return;}
    }
    move(index+1);
  }
  function close() {wizard.hidden=true;$('landing').inert=false;document.body.style.overflow='';$('start').focus();}
  $('start').addEventListener('click',()=>{wizard.hidden=false;$('landing').inert=true;document.body.style.overflow='hidden';index=0;paint();});
  $('close').addEventListener('click',close);$('back').addEventListener('click',()=>{if(index>0){if(current()==='contact')for(const field of ['name','phone','location'])state[field]=$(field).value;move(index-1);}});$('next').addEventListener('click',()=>{if(current()!=='contact')advance();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!wizard.hidden){if(current()==='items'&&$('suggestions')&&!$('suggestions').hidden)return;close();}});
})();
