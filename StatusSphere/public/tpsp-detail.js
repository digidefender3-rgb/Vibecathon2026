document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const serviceName = params.get('service');
    
    if (!serviceName) {
        document.getElementById('tpsp-name-title').textContent = 'Service Not Found';
        return;
    }

    try {
        const res = await fetch('/api/config');
        const entityConfig = await res.json();
        
        // Find banks using this service and aggregate its data
        const linkedBanks = [];
        let tpspData = { name: serviceName, provider: '', type: '', statusCode: 'unknown', vuln: null, vulnDate: null };
        
        for (const [slug, cfg] of Object.entries(entityConfig)) {
            if (cfg.category === 'bank' && cfg.services) {
                const serviceMatch = cfg.services.find(s => s.name === serviceName);
                if (serviceMatch) {
                    linkedBanks.push(cfg.name);
                    
                    // Prioritize carrying over vulnerability data if it exists anywhere natively
                    if (serviceMatch.statusCode === 'vuln_noted') {
                        tpspData.statusCode = 'vuln_noted';
                        tpspData.vuln = serviceMatch.vulnerability;
                        tpspData.vulnDate = serviceMatch.vulnerabilityDate;
                    } else if (tpspData.statusCode === 'unknown' && serviceMatch.statusCode === 'no_vuln') {
                        tpspData.statusCode = 'no_vuln';
                    }
                    
                    if (!tpspData.provider) tpspData.provider = serviceMatch.provider;
                    if (!tpspData.type) tpspData.type = serviceMatch.type;
                }
            }
        }
        
        document.getElementById('tpsp-name-title').textContent = serviceName;
        document.getElementById('tpsp-subtitle').textContent = `Provided by ${tpspData.provider || 'Unknown'} — ${tpspData.type || 'Integration'}`;

        const badgeHtml = document.getElementById('tpsp-status-badge');
        const vulnBox = document.getElementById('vuln-details-box');
        
        let nodeColor = '#38bdf8'; // Blue default
        let fontColor = '#ffffff';

        if (tpspData.statusCode === 'vuln_noted') {
            badgeHtml.innerHTML = `<span class="status-lbl lbl-red" style="font-size: 1rem">&lt;Vulnerabilities noted&gt;</span>`;
            nodeColor = '#ef4444'; // Red center node
            
            vulnBox.style.display = 'block';
            document.getElementById('vuln-text').innerHTML = `<strong>${tpspData.vuln}</strong>`;
            if (tpspData.vulnDate) {
                document.getElementById('vuln-date').textContent = `Flagged: ${tpspData.vulnDate} (New)`;
            }
        } else if (tpspData.statusCode === 'unknown') {
            badgeHtml.innerHTML = `<span class="status-lbl lbl-yellow" style="font-size: 1rem">&lt;Unknown&gt;</span>`;
            nodeColor = '#eab308'; // Yellow center node
            fontColor = '#0f172a';
        } else {
            badgeHtml.innerHTML = `<span class="status-lbl lbl-green" style="font-size: 1rem">&lt;No vulnerabilities noted&gt;</span>`;
            nodeColor = '#10b981'; // Green center node
        }

        // Build the Vis.js Graph Dataset
        if (!window.vis) {
            console.error('Vis.js failed to load.');
            return;
        }

        const nodes = new vis.DataSet([
            { id: 1, label: serviceName, shape: 'box', color: { background: nodeColor, border: nodeColor }, font: { color: fontColor, size: 20, face: 'Inter', bold: true }, margin: 15 }
        ]);
        
        const edges = new vis.DataSet([]);
        
        let nodeId = 2;
        linkedBanks.forEach(bank => {
            nodes.add({ id: nodeId, label: bank, shape: 'dot', color: '#64748b', font: { color: '#cbd5e1', size: 15, face: 'Inter', bold: true }, size: 22 });
            edges.add({ from: 1, to: nodeId, color: { color: '#334155', opacity: 1 }, width: 2, length: 180 });
            nodeId++;
        });

        const container = document.getElementById('network-container');
        const data = { nodes, edges };
        const options = {
            nodes: {
                shadow: {
                    enabled: true,
                    color: 'rgba(0,0,0,0.5)',
                    size: 10,
                    x: 5,
                    y: 5
                }
            },
            physics: {
                solver: 'forceAtlas2Based',
                forceAtlas2Based: {
                    gravitationalConstant: -100,
                    centralGravity: 0.015,
                    springLength: 200,
                    springConstant: 0.05
                }
            },
            interaction: {
                hover: true,
                zoomView: true
            }
        };
        
        new vis.Network(container, data, options);

    } catch (e) {
        console.error('Failed to load TPSP link data:', e);
        document.getElementById('tpsp-name-title').textContent = 'Error mapping linkages';
    }
});
