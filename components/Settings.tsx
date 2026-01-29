               <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar border border-gray-100 rounded-lg p-2">
                   {daysOrder.map((day: keyof Schedule) => {
                       const daySchedule = (tempSchedule as any)[day] as DaySchedule;
                       return (
                       <div key={day} className="flex flex-col md:flex-row md:items-center gap-4 p-2 bg-gray-50 rounded border border-gray-100">
                           <div className="w-24 font-bold capitalize text-sm flex items-center gap-2">
                               <input type="checkbox" checked={daySchedule.enabled} onChange={e => handleTempScheduleChange(day, 'enabled', e.target.checked)} disabled={!hasPermission('settings:edit_templates')} />
                               {day}
                           </div>
                           <div className={`flex items-center gap-2 flex-1 ${!daySchedule.enabled ? 'opacity-40 pointer-events-none' : ''}`}>
                               <input type="time" value={daySchedule.start} onChange={e => handleTempScheduleChange(day, 'start', e.target.value)} className="border rounded px-2 py-1 text-sm disabled:bg-gray-100" disabled={!hasPermission('settings:edit_templates')} />
                               <span className="text-xs text-gray-400">até</span>
                               <input type="time" value={daySchedule.end} onChange={e => handleTempScheduleChange(day, 'end', e.target.value)} className="border rounded px-2 py-1 text-sm disabled:bg-gray-100" disabled={!hasPermission('settings:edit_templates')} />
                               <label className="flex items-center gap-1 ml-4 text-xs">
                                   <input type="checkbox" checked={daySchedule.startsPreviousDay} onChange={e => handleTempScheduleChange(day, 'startsPreviousDay', e.target.checked)} disabled={!hasPermission('settings:edit_templates')} /> 
                                   Inicia dia anterior
                               </label>
                           </div>
                       </div>
                   )})}
               </div>