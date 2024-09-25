const { exec } = require('child_process');
const dns = require('dns');
const Table = require('cli-table3');

const dnsServers = [
    ['178.22.122.100', '185.51.200.2', 'Shecan'],
    ['10.202.10.202', '10.202.10.102', '403 online'],
    ['78.157.42.100', '78.157.42.101', 'Electro Team'],
    ['185.55.226.26', '185.55.225.25', 'Begzar'],
    ['10.202.10.10', '10.202.10.11', 'Radar Game'],
    ['208.67.222.222', '208.67.220.220', 'OpenDNS'],
    ['1.1.1.1', '1.0.0.1', 'Cloudflare'],
    ['8.8.8.8', '8.8.4.4', 'Google'],
    ['8.26.56.10', '8.20.247.10', 'Comodo Secure'],
    ['9.9.9.9', '149.112.112.112', 'Quad9'],
    ['129.250.35.250', '129.250.35.251', 'NTT'],
    ['204.117.214.10', '199.2.252.10', 'Sprintlink'],
];

// Replace with actual domain names you want to test
const domains = []; // Add domains like 'epicgames.com', 'fortnite.com'

// Function to ping an IP address and measure latency
const pingServer = (ip) => {
    return new Promise((resolve) => {
        exec(`ping ${process.platform === 'win32' ? '-n' : '-c'} 4 ${ip}`, (error, stdout) => {
            const match = stdout.match(/Average = (\d+)ms|time=(\d+\.?\d*) ms/);
            const latency = match ? parseFloat(match[1] || match[2]) : Infinity;
            resolve({ ip, latency });
        });
    });
};

// Function to resolve domains using a specified DNS server
const testServers = async (dnsServer, domain) => {
    dns.setServers([dnsServer]);
    return new Promise((resolve) => {
        dns.resolve4(domain, (err, addresses) => {
            if (err || !addresses.length) {
                return resolve([]);
            }
            resolve(addresses);
        });
    });
};

// Main function to test all DNS servers in parallel
const testDNSServers = async () => {
    const { default: ora } = await import('ora');
    const spinner = ora('Testing DNS servers...').start();

    const results = {};

    // Initialize results object for each domain and DNS server
    for (const domain of domains) {
        results[domain] = dnsServers.map((dnsServer) => ({
            name: dnsServer[2],
            server: `${dnsServer[0]}, ${dnsServer[1]}`,
            latency: Infinity,
        }));
    }

    // Create test promises for each DNS server and domain combination
    const testPromises = dnsServers.flatMap((dnsServer, i) =>
        domains.map(async (domain) => {
            try {
                spinner.text = `Testing DNS ${i + 1} (${dnsServer[2]}) for ${domain}...`;

                // Test the DNS server by resolving the domain
                const addresses = await testServers(dnsServer[0], domain);
                const ips = addresses.flat();

                if (ips.length === 0) {
                    spinner.warn(`DNS ${i + 1} (${dnsServer[2]}) had no resolved IPs for ${domain}.`);
                    return;
                }

                // Ping the resolved IPs in parallel
                const pingResults = await Promise.all(ips.map(pingServer));
                const averageLatency =
                    pingResults.reduce((sum, result) => sum + result.latency, 0) /
                        pingResults.length || Infinity;

                // Save the average latency for the domain and DNS server
                results[domain][i].latency = averageLatency;
            } catch (error) {
                spinner.fail(`Error testing DNS ${dnsServer[2]}: ${error.message}`);
            }
        })
    );

    // Await all test promises to complete
    await Promise.all(testPromises);
    spinner.succeed('Finished testing DNS servers.');

    // Create and display tables for each domain
    for (const domain of domains) {
        console.log(`\nLatency results for domain: ${domain}`);

        const table = new Table({
            head: ['DNS Server', 'Primary IP, Secondary IP', 'Latency (ms)'],
            colWidths: [20, 30, 20],
        });

        results[domain]
            .filter((result) => result.latency !== Infinity)
            .sort((a, b) => a.latency - b.latency)
            .forEach((result) => {
                table.push([result.name, result.server, result.latency.toFixed(1)]);
            });

        if (table.length > 0) {
            console.log(table.toString());
        } else {
            console.log('No DNS server returned a valid latency for this domain.');
        }
    }
};

testDNSServers();
