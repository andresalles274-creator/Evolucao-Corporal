// Shared by the registration form and the coach's read-only intake view.
export const intakeSections = [
 {title:'Dados pessoais',fields:[
  {key:'full_name',label:'Nome completo',required:true,maxlength:160},
  {key:'phone',label:'Telefone / WhatsApp',type:'tel',maxlength:40},
  {key:'birth_date',label:'Data de nascimento',type:'date'},
  {key:'age',label:'Idade',type:'number',min:1,max:120,step:1},
  {key:'gender',label:'Sexo',options:[['','Prefiro não informar'],['male','Masculino'],['female','Feminino']]},
  {key:'height_cm',label:'Altura (cm)',type:'number',min:30,max:250,step:0.1},
  {key:'city',label:'Cidade',maxlength:120},{key:'state',label:'Estado / região',maxlength:80},
  {key:'occupation',label:'Profissão',maxlength:160},
  {key:'emergency_name',label:'Nome do contato de emergência',maxlength:160},
  {key:'emergency_phone',label:'Telefone do contato de emergência',type:'tel',maxlength:40}
 ]},
 {title:'Objetivos e rotina',fields:[
  {key:'goal',label:'Objetivo principal',options:[['','Escolher depois'],['Hipertrofia','Hipertrofia'],['Emagrecimento','Emagrecimento'],['Recomposição corporal','Recomposição corporal'],['Condicionamento','Condicionamento'],['Saúde','Saúde']]},
  {key:'priority_areas',label:'Prioridades e resultados que deseja',type:'textarea'},
  {key:'training_level',label:'Experiência com musculação',options:[['','Não informado'],['Iniciante','Iniciante'],['Intermediário','Intermediário'],['Avançado','Avançado']]},
  {key:'training_days',label:'Dias disponíveis por semana',type:'number',min:1,max:7,step:1},
  {key:'training_minutes',label:'Tempo disponível por treino (minutos)',type:'number',min:10,max:300,step:1},
  {key:'training_place',label:'Onde pretende treinar?',maxlength:200},
  {key:'training_time',label:'Horário habitual de treino',type:'time'},
  {key:'exercise_history',label:'Atividades físicas atuais e anteriores',type:'textarea'},
  {key:'work_routine',label:'Rotina de trabalho (sentado, em pé, esforço físico)',type:'textarea'},
  {key:'wake_time',label:'Horário em que acorda',type:'time'},
  {key:'sleep_time',label:'Horário em que dorme',type:'time'},
  {key:'sleep_hours',label:'Horas de sono por noite',type:'number',min:1,max:16,step:0.5},
  {key:'meals_per_day',label:'Refeições por dia',type:'number',min:1,max:12,step:1},
  {key:'water_liters',label:'Água por dia (litros)',type:'number',min:0.1,max:15,step:0.1},
  {key:'food_preferences',label:'Alimentos de que gosta',type:'textarea'},
  {key:'food_aversions',label:'Alimentos de que não gosta',type:'textarea'},
  {key:'current_diet',label:'Como é sua alimentação atualmente? Inclua os horários, se souber.',type:'textarea'}
 ]},
 {title:'Histórico de saúde',fields:[
  {key:'health_conditions',label:'Condições de saúde e diagnósticos informados',type:'textarea'},
  {key:'injuries',label:'Lesões atuais ou anteriores',type:'textarea'},
  {key:'surgeries',label:'Cirurgias realizadas e datas aproximadas',type:'textarea'},
  {key:'pain',label:'Dores, movimentos que incomodam e limitações',type:'textarea'},
  {key:'medications',label:'Medicamentos e suplementos em uso',type:'textarea'},
  {key:'allergies',label:'Alergias e intolerâncias alimentares',type:'textarea'},
  {key:'medical_followup',label:'Acompanhamento médico e orientações recebidas',type:'textarea'},
  {key:'restrictions',label:'Restrições médicas para exercícios',type:'textarea'},
  {key:'pregnancy_postpartum',label:'Gestação ou pós-parto, se aplicável',type:'textarea'},
  {key:'exams_history',label:'Exames já realizados, datas e informações disponíveis',type:'textarea'},
  {key:'additional_notes',label:'Outras informações que o coach precisa saber',type:'textarea'}
 ]},
 {title:'Medidas corporais',fields:[
  {key:'assessment_date',label:'Data das medidas',type:'date'},
  {key:'weight',label:'Peso (kg)',type:'number',min:1,max:500,step:0.1},
  ...[['waist','Cintura'],['hip','Quadril'],['glute','Glúteos'],['chest','Tórax'],['arm_right','Braço direito'],['arm_left','Braço esquerdo'],['forearm_right','Antebraço direito'],['forearm_left','Antebraço esquerdo'],['thigh_right','Coxa direita'],['thigh_left','Coxa esquerda'],['calf_right','Panturrilha direita'],['calf_left','Panturrilha esquerda']].map(([key,label])=>({key,label:label+' (cm)',type:'number',min:1,max:300,step:0.1}))
 ]}
];
