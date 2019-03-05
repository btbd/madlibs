madlibs: *.go
	go fmt & go build -ldflags "-w -extldflags -static" -tags netgo -installsuffix netgo -o madlibs

clean:
	rm -f madlibs