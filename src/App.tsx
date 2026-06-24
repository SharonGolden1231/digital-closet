{result.search && result.search.query && (
                  <div className="mt-3 pt-3" style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                    <p className="text-xs uppercase tracking-wider font-medium mb-1.5" style={{ color: "var(--mid-grey)" }}>
                      Find this item online
                    </p>
                    
                      href={"https://www.google.com/search?q=" + encodeURIComponent(result.search.query) + "&tbm=shop"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs"
                      style={{ color: "var(--emerald-bright)" }}
                    >
                      <ExternalLink size={10} /> Search: {result.search.query}
                    </a>
                  </div>
                )}
