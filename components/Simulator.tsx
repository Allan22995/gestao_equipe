                          <div>
                              <MultiSelect 
                                label="FILTRAR POR FILIAL"
                                options={availableBranches}
                                selected={filterBranches}
                                onChange={(val: string[]) => setFilterBranches(val)}
                                placeholder={availableBranches.length > 1 ? 'Todas' : 'Sua Filial'}
                                disabled={availableBranches.length === 1}
                              />
                          </div>

                          <div>
                              <MultiSelect 
                                label="FILTRAR POR SETOR"
                                options={availableSectors}
                                selected={filterSectors}
                                onChange={(val: string[]) => setFilterSectors(val)}
                                placeholder="Todos os Setores"
                                disabled={currentUserAllowedSectors.length === 1}
                              />
                          </div>
                          
                          <div>
                              <MultiSelect 
                                label="FILTRAR POR FUNÇÃO"
                                options={availableRolesOptions}
                                selected={filterRoles}
                                onChange={(val: string[]) => setFilterRoles(val)}
                                placeholder="Todas as Funções"
                              />
                          </div>

                          <div>
                              <MultiSelect 
                                label="FILTRAR POR JORNADA/ESCALA"
                                options={availableScalesOptions}
                                selected={filterScales}
                                onChange={(val: string[]) => setFilterScales(val)}
                                placeholder="Todas as Jornadas"
                              />
                          </div>